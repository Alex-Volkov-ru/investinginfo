const BACKEND =
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : '/api';

const api = axios.create({ baseURL: BACKEND, timeout: 20000 });

// Tabs
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

// Login
document.getElementById('loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  document.getElementById('loginErr').style.display='none';
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try{
    const { data } = await api.post('/auth/login', { email, password });
    const token = data?.access_token || data?.token || data?.jwt;
    if(!token) throw new Error('Нет токена');
    localStorage.setItem('pf_token', token);

    // Опционально подтянем профиль — пригодится в шапке
    try{
      const me = (await api.get('/users/me', { headers: { Authorization: `Bearer ${token}` } })).data;
      if(me){
        localStorage.setItem('pf_user_id', me.id || '');
        localStorage.setItem('pf_email', me.email || '');
        if (me.tg_username) localStorage.setItem('pf_tg_username', me.tg_username);
      }
    }catch(_){}

    window.location.replace('index.html');
  }catch(err){
    console.error(err);
    document.getElementById('loginErr').style.display='block';
  }
});

// Register (с полем токена)
document.getElementById('registerForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
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
    document.getElementById('regErr').textContent = 'Проверьте email, пароль и телефон';
    document.getElementById('regErr').style.display='block';
    return;
  }

  try{
    await api.post('/users/register', {
      email, password, tg_username: tg_username || null, phone: phone || null,
      tinkoff_token: tinkoff_token || null
    });
    alert('Регистрация успешна. Войдите под своим email и паролем.');
    tabLogin.click();
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = '';
  }catch(err){
    alert(err?.response?.data?.detail || 'Ошибка регистрации');
  }
});
