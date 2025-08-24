const BACKEND =
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : '/api';

const api = axios.create({ baseURL: BACKEND, timeout: 20000 });

let auth = { token:null, userId:null, email:null };
function loadAuth(){
  auth.token = localStorage.getItem('pf_token') || null;
  auth.userId = Number(localStorage.getItem('pf_user_id') || '') || null;
  auth.email  = localStorage.getItem('pf_email') || null;
}
function applyAuthUi(){
  const st = document.getElementById('authStatus');
  const btnOut = document.getElementById('logoutBtn');
  if(!st || !btnOut) return;
  if(auth.token && auth.email){
    st.textContent = `Привет, ${auth.email}`;
    btnOut.style.display = '';
  }else{
    st.textContent = 'Гость';
    btnOut.style.display = 'none';
  }
}
function clearAuth(){
  localStorage.removeItem('pf_token');
  localStorage.removeItem('pf_user_id');
  localStorage.removeItem('pf_email');
  localStorage.removeItem('pf_portfolio_id');
  localStorage.removeItem('pf_tg_username');
}

function setTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('pf_theme', t); }
function initTheme(){ const t = localStorage.getItem('pf_theme') || 'dark'; setTheme(t); }

api.interceptors.request.use(cfg=>{
  if(auth.token){
    cfg.headers = cfg.headers || {};
    cfg.headers['Authorization'] = `Bearer ${auth.token}`;
  }
  return cfg;
});

async function apiGetMe(){ try{ const { data } = await api.get('/users/me'); return data; }catch{ return null; } }
function setApiIndicator(on){
  const dot = document.getElementById('apiStatusDot');
  if(dot) dot.style.background = on ? 'var(--ok)' : '#888';
}
async function refreshApiIndicator(){
  const me = await apiGetMe();
  setApiIndicator(!!(me && me.has_tinkoff));
}

function hookTokenModal(){
  const tokenModal = document.getElementById('tokenModal');
  const openBtn = document.getElementById('apiStatusBtn');
  const cancelBtn = document.getElementById('modalCancelBtn');
  const clearBtn = document.getElementById('modalClearBtn');
  const saveBtn = document.getElementById('modalSaveBtn');
  const input = document.getElementById('modalTinkoffToken');
  const closeX = document.getElementById('modalCancelX');

  const open = ()=> tokenModal.classList.add('modal--open');
  const close = ()=> tokenModal.classList.remove('modal--open');

  openBtn?.addEventListener('click', ()=>{
    if(!auth.token){ alert('Сначала войдите'); return; }
    if(input) input.value = '';
    open();
  });
  [cancelBtn, closeX].forEach(b=> b && b.addEventListener('click', close));
  tokenModal?.addEventListener('click', (e)=>{ if(e.target.id==='tokenModal') close(); });

  clearBtn?.addEventListener('click', async ()=>{
    if(!confirm('Очистить сохранённый токен?')) return;
    try{
      await api.put('/users/me/token', { tinkoff_token: null });
      await refreshApiIndicator();
      close();
      alert('Токен очищен');
    }catch(e){
      alert(e?.response?.data?.detail || 'Ошибка при очистке');
    }
  });

  saveBtn?.addEventListener('click', async ()=>{
    const val = (input?.value || '').trim();
    if(!val){ alert('Введите токен или нажмите «Очистить»'); return; }
    if(!/^t\./i.test(val)){
      if(!confirm('Токен не начинается с "t." — сохранить?')) return;
    }
    try{
      await api.put('/users/me/token', { tinkoff_token: val });
      await refreshApiIndicator();
      close();
      alert('Токен сохранён');
    }catch(e){
      alert(e?.response?.data?.detail || 'Ошибка сохранения');
    }
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  initTheme();

  document.getElementById('themeToggle')?.addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme')==='dark' ? 'light' : 'dark';
    setTheme(cur);
  });

  loadAuth();
  applyAuthUi();
  hookTokenModal();
  await refreshApiIndicator();

  document.getElementById('logoutBtn')?.addEventListener('click', ()=>{
    clearAuth();
    location.href = 'login.html';
  });
});
