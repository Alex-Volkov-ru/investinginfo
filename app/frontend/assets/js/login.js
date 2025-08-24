const BACKEND =
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : '/api';

const api = axios.create({ baseURL: BACKEND, timeout: 20000 });

/* ---------- Mini UI helpers ---------- */
function toast(msg, type='ok'){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + (type==='err' ? 'err' : 'ok');
  el.innerHTML = `<div>${msg}</div>`;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity=.0; el.style.transform='translateY(6px)' }, 2200);
  setTimeout(()=> el.remove(), 2600);
}

const scr = {
  el: document.getElementById('screenLoader'),
  title: document.getElementById('loaderTitle'),
  sub: document.getElementById('loaderSub'),
  bar: document.getElementById('loaderBar'),
  open(title='Входим…', sub='Проверяем данные'){
    this.title.textContent = title; this.sub.textContent = sub; this.bar.style.width='0%';
    this.el.classList.add('open');
  },
  progress(p){ this.bar.style.width = Math.max(0,Math.min(100,p)) + '%'; },
  done(msg='Готово!'){
    this.title.textContent = msg;
    this.sub.textContent = 'Перенаправляем в личный кабинет…';
    this.progress(100);
  },
  close(){ this.el.classList.remove('open'); }
};

/* ---------- Tabs ---------- */
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginPane = document.getElementById('loginPane');
const registerPane = document.getElementById('registerPane');

tabLogin.addEventListener('click', ()=>{
  tabLogin.classList.add('active'); tabRegister.classList.remove('active');
  loginPane.style.display=''; registerPane.style.display='none';
});
tabRegister.addEventListener('click', ()=>{
  tabRegister.classList.add('active'); tabLogin.classList.remove('active');
  registerPane.style.display=''; loginPane.style.display='none';
});

/* ---------- Common auth helpers ---------- */
async function fetchAndStoreProfile(token){
  try{
    const me = (await api.get('/users/me', { headers:{ Authorization:`Bearer ${token}` } })).data;
    if(me){
      localStorage.setItem('pf_user_id', me.id || '');
      localStorage.setItem('pf_email', me.email || '');
      if (me.tg_username) localStorage.setItem('pf_tg_username', me.tg_username);
    }
  }catch(_){}
}

async function afterAuthRedirect(){
  // красивая анимация ухода и переход
  scr.done();
  setTimeout(()=>{
    document.body.classList.add('leaving');
    setTimeout(()=> window.location.replace('index.html'), 450);
  }, 250);
}

async function doLogin(email, password){
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  document.getElementById('loginErr').style.display='none';
  scr.open('Входим…','Проверяем данные');
  scr.progress(30);

  try{
    const { data } = await api.post('/auth/login', { email, password });
    const token = data?.access_token || data?.token || data?.jwt;
    if(!token) throw new Error('Нет токена');
    scr.progress(65);
    localStorage.setItem('pf_token', token);
    await fetchAndStoreProfile(token);
    scr.progress(90);
    await afterAuthRedirect();
  }catch(err){
    console.error(err);
    scr.close();
    btn.disabled = false;
    const errBox = document.getElementById('loginErr');
    errBox.textContent = (err?.response?.data?.detail || 'Неверный email или пароль');
    errBox.style.display='block';
  }
}

/* ---------- Login ---------- */
document.getElementById('loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  await doLogin(email, password);
});

/* ---------- Register + auto login ---------- */
document.getElementById('registerForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const regBtn = document.getElementById('regBtn');
  regBtn.disabled = true;
  document.getElementById('regErr').style.display='none';

  const tg_username = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const phone = document.getElementById('regPhone').value.trim();
  const tinkoff_token = document.getElementById('regTinkoff').value.trim();

  // простая фронт-валидация
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passOk = password.length >= 6 && /[A-Za-z]/.test(password) && /\d/.test(password);
  const phoneOk = !phone || /^\+?\d{10,15}$/.test(phone);
  if(!emailOk || !passOk || !phoneOk){
    const eBox = document.getElementById('regErr');
    eBox.textContent = 'Проверьте email, пароль (мин. 6 символов, буквы и цифры) и телефон';
    eBox.style.display='block';
    regBtn.disabled = false;
    return;
  }

  try{
    scr.open('Создаём аккаунт…','Подготавливаем профиль');
    scr.progress(25);

    await api.post('/users/register', {
      email, password, tg_username: tg_username || null, phone: phone || null,
      tinkoff_token: tinkoff_token || null
    });

    scr.progress(55);
    toast('Регистрация успешна 🎉', 'ok');

    // Автовход теми же данными
    const { data } = await api.post('/auth/login', { email, password });
    const token = data?.access_token || data?.token || data?.jwt;
    if(!token) throw new Error('Нет токена после регистрации');
    localStorage.setItem('pf_token', token);

    scr.progress(75);
    await fetchAndStoreProfile(token);

    await afterAuthRedirect();
  }catch(err){
    console.error(err);
    scr.close();
    const eBox = document.getElementById('regErr');
    eBox.textContent = err?.response?.data?.detail || 'Ошибка регистрации';
    eBox.style.display='block';
    regBtn.disabled = false;
  }
});
