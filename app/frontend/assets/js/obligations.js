(() => {
  'use strict';
  if (window.__OBLIGATIONS_APP_INITIALIZED__) return;
  window.__OBLIGATIONS_APP_INITIALIZED__ = true;

  // ===== Theme =====
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('pf_theme', t); } catch(_) {}
  }
  (function initTheme(){
    const t = localStorage.getItem('pf_theme') || 'dark';
    setTheme(t);
  })();

  // ===== Toast =====
  function toast(msg, type='ok', ms=2400){
    const wrap = document.getElementById('toastWrap');
    const el = document.createElement('div');
    el.className = 'toast ' + (type==='err' ? 'err' : 'ok');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(()=>{ el.style.opacity = 0; el.style.transform = 'translateY(6px)'; }, ms-300);
    setTimeout(()=> el.remove(), ms);
  }

  // ===== Auth UI =====
  (function applyAuth(){
    const st = document.getElementById('authStatus');
    const name = localStorage.getItem('pf_tg_username') || localStorage.getItem('pf_email');
    st.textContent = name ? `Привет, ${name}` : 'Гость';
  })();

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    ['pf_token','pf_email','pf_tg_username','pf_user_id','pf_portfolio_id'].forEach(k=> localStorage.removeItem(k));
    window.location.replace('login.html');
  });

  // ===== Backend (для пинга) =====
  const token = localStorage.getItem('pf_token') || '';
  const isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
  const baseURL = isLocal ? 'http://127.0.0.1:8000' : '/api';
  const api = axios.create({ baseURL, timeout: 15000 });
  api.interceptors.request.use(cfg => {
    if (token) {
      cfg.headers = cfg.headers || {};
      cfg.headers.Authorization = `Bearer ${token}`;
    }
    return cfg;
  });

  // ===== Header buttons =====
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });

  document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    try { await api.get('/health/ping'); toast('API: ok'); }
    catch { toast('API недоступно', 'err', 3000); }
  });

  // ===== Help modal =====
  const help = {
    root: document.getElementById('helpModal'),
    open(){ this.root.classList.add('modal--open'); document.body.style.overflow = 'hidden'; },
    close(){ this.root.classList.remove('modal--open'); document.body.style.overflow = ''; }
  };
  document.getElementById('helpBtn')?.addEventListener('click', ()=> help.open());
  document.getElementById('helpCloseBtn')?.addEventListener('click', ()=> help.close());
  document.getElementById('helpCloseX')?.addEventListener('click', ()=> help.close());
  help.root?.addEventListener('click', (e)=>{ if(e.target === help.root) help.close(); });

  // ===== Collapsible (плейсхолдер) =====
  function anyOpen(){ return document.querySelectorAll('.section.open').length > 0; }
  function updateToggleAllBtn(){
    const btn = document.getElementById('toggleAllBtn'); if(!btn) return;
    const open = anyOpen();
    btn.textContent = open ? '⤵️ Все' : '⤴️ Все';
    btn.title = open ? 'Свернуть все секции (S)' : 'Развернуть все секции (S)';
  }
  updateToggleAllBtn();

  document.addEventListener('click', (e)=>{
    const t = e.target.closest('[data-action="toggle-section"]'); if(!t) return;
    const secId = t.getAttribute('data-section');
    const section = document.getElementById(secId);
    const body = section?.querySelector('.section-body');
    const willOpen = !section.classList.contains('open');

    // быстрая анимация — синхронно со style.css
    const dur = 140;
    body.style.transition = `height ${dur}ms ease, opacity ${dur}ms ease`;
    if (willOpen){
      section.classList.add('open');
      body.style.height = '0px'; body.style.opacity = '0'; void body.offsetHeight;
      body.style.height = body.scrollHeight + 'px'; body.style.opacity = '1';
      setTimeout(()=>{ body.style.height='auto'; body.style.transition=''; }, dur+20);
    } else {
      const h = body.scrollHeight;
      body.style.height = h + 'px'; body.style.opacity = '1'; void body.offsetHeight;
      body.style.height = '0px'; body.style.opacity = '0';
      setTimeout(()=>{ section.classList.remove('open'); body.style.transition=''; }, dur+20);
    }
    updateToggleAllBtn();
  });

  document.getElementById('toggleAllBtn')?.addEventListener('click', ()=>{
    const open = anyOpen();
    document.querySelectorAll('.section').forEach(s=>{
      const body = s.querySelector('.section-body');
      if (open && s.classList.contains('open')) {
        s.querySelector('[data-action="toggle-section"]')?.click();
      } else if (!open && !s.classList.contains('open')) {
        s.querySelector('[data-action="toggle-section"]')?.click();
      }
    });
    updateToggleAllBtn();
  });

  // ===== Hotkeys =====
  function focusSearch(){ const el = document.getElementById('searchInput'); if(el){ el.focus(); el.select?.(); } }
  document.addEventListener('keydown', (e)=>{
    const tag = (e.target?.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
    if (e.key === '/') { if(!typing){ e.preventDefault(); focusSearch(); } return; }
    if (typing) return;
    const k = e.key.toLowerCase();
    if (k === 'r'){ e.preventDefault(); document.getElementById('refreshBtn')?.click(); }
    if (k === 't'){ e.preventDefault(); document.getElementById('themeToggle')?.click(); }
    if (k === 's'){ e.preventDefault(); document.getElementById('toggleAllBtn')?.click(); }
    if (e.key === '?' || (e.shiftKey && e.key === '/')){ e.preventDefault(); help.open(); }
  });

  // первый пинг «молча», чтобы проверить API (без зелёной точки в UI)
  (async ()=>{ try{ await api.get('/health/ping'); }catch{} })();
})();
