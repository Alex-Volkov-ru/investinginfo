/* global axios, Chart */
(() => {
  'use strict';
  if (window.__BUDGET_APP_INITIALIZED__) return;
  window.__BUDGET_APP_INITIALIZED__ = true;

  // ===== Chart.js defaults =====
  Chart.defaults.font.family = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.resizeDelay = 120;

  // ===== helpers =====
  const $ = s => document.querySelector(s);
  const setText = (el, v) => { if (el) el.textContent = v; };
  const fmtMoney = (v, cur='RUB') => new Intl.NumberFormat('ru-RU', {style:'currency', currency:cur, maximumFractionDigits:2}).format(Number(v||0));
  const nfPct = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  const humanType = row => row.type==='income' ? 'Доход' : (row.type==='expense' ? 'Расход' : 'Перевод');

  // ===== Telegram/iOS top bar offset =====
  (function setTelegramTopOffset(){
    const ua = navigator.userAgent.toLowerCase();
    const isTg  = /telegram/i.test(navigator.userAgent);
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const extra = (isTg && isIOS) ? 44 : 0; // примерная высота верхней панели Telegram
    document.documentElement.style.setProperty('--tg-top', extra + 'px');
  })();

  // ===== Theme =====
  function setTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('pf_theme', t); }
  (function initTheme(){ setTheme(localStorage.getItem('pf_theme') || 'dark'); })();
  function onThemeChanged(){ requestAnimationFrame(()=> loadCharts(activeAbort?.signal)); }
  document.getElementById('themeToggle')?.addEventListener('click', ()=>{
    const next = document.documentElement.getAttribute('data-theme')==='dark' ? 'light' : 'dark';
    setTheme(next); onThemeChanged();
  });
  new MutationObserver(m=>{ if (m.some(x=>x.attributeName==='data-theme')) onThemeChanged(); })
    .observe(document.documentElement, { attributes:true });

  // ===== Greeting / logout =====
  (function applyAuthUi(){
    const st = document.getElementById('authStatus');
    const name = localStorage.getItem('pf_tg_username') || localStorage.getItem('pf_email');
    st.textContent = name ? `Привет, ${name}` : 'Гость';
  })();
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('pf_token'); localStorage.removeItem('pf_email'); localStorage.removeItem('pf_tg_username');
    window.location.replace('login.html');
  });

  // ===== AXIOS =====
  const token = localStorage.getItem('pf_token');
  if (!token) { window.location.href = 'login.html'; return; }
  const isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
  const baseURL = isLocal ? 'http://127.0.0.1:8000' : '/api';
  const api = axios.create({ baseURL, timeout: 20000 });
  api.interceptors.request.use(cfg => { cfg.headers = cfg.headers || {}; cfg.headers.Authorization = `Bearer ${token}`; return cfg; });

  // ===== Dates helpers =====
  function fmtDate(val){
    if (!val) return '—';
    const d = new Date(val);
    if (!isNaN(d)) return d.toLocaleDateString('ru-RU');
    const p = String(val).split('-');
    if (p.length===3) return new Date(p[0], p[1]-1, p[2]).toLocaleDateString('ru-RU');
    return String(val);
  }
  function monthRange(){
    const ymEl = /** @type {HTMLInputElement} */($('#periodInput'));
    const ym = ymEl?.value; const now = new Date();
    const y = ym ? Number(ym.split('-')[0]) : now.getFullYear();
    const m = ym ? Number(ym.split('-')[1]) : (now.getMonth()+1);
    const from = `${y}-${String(m).padStart(2,'0')}-01`;
    const last = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2,'0')}-${String(last).padStart(2,'0')}`;
    if(!ym && ymEl) ymEl.value = `${y}-${String(m).padStart(2,'0')}`;
    return { from, to, year:y, month:m, days:last };
  }

  // ===== API ping =====
  function setApiIndicator(on){ const dot = document.getElementById('apiStatusDot'); if (dot) dot.style.background = on ? 'var(--ok)' : '#888'; }
  async function ping(signal){ try{ await api.get('/health/ping', {signal}); setApiIndicator(true); }catch{ setApiIndicator(false); } }

  // ===== STATE =====
  let ACCOUNTS=[], CATS_IN=[], CATS_EX=[], MAP_ACC={}, MAP_CAT={}, MONTH_TX=[];
  let modalType='income', modalKind='income';
  let isRefreshing=false, timerId=null, activeAbort=null;
  const REFRESH_MS = 60*1000;

  // ===== Charts =====
  const donutCenter = (getInfo)=>({
    id:'donutCenter',
    beforeDraw(chart){
      const meta = chart.getDatasetMeta(0); if(!meta || !meta.data || !meta.data.length) return;
      const arc = meta.data[0]; const {x,y} = arc; const innerR = arc.innerRadius;
      const ctx = chart.ctx; const root = document.documentElement;
      const box = chart.canvas.closest('.chart-box');
      const css = (el, v)=> (el ? getComputedStyle(el).getPropertyValue(v).trim() : '');
      const bg    = css(box,'--input-bg') || css(root,'--input-bg') || css(root,'--card') || '#151935';
      const text  = css(root,'--text') || '#ecf0ff';
      const muted = css(root,'--muted') || '#a0a7c9';
      ctx.save();
      ctx.beginPath(); ctx.arc(x,y,Math.max(innerR-2,0),0,Math.PI*2); ctx.fillStyle=bg; ctx.fill();
      const info = getInfo(chart);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle=muted; ctx.font='700 12px Inter'; if(info.title) ctx.fillText(info.title,x,y-18);
      ctx.fillStyle=text;  ctx.font='800 16px Inter'; if(info.line1) ctx.fillText(info.line1,x,y+2);
      if(info.line2){ ctx.fillStyle=info.line2Color || muted; ctx.font='800 12px Inter'; ctx.fillText(info.line2,x,y+20); }
      ctx.restore();
    }
  });
  function hsl(h,s,l,a=1){ return `hsla(${h} ${s}% ${l}% / ${a})`; }
  function catPalette(ctx, labels, kind){
    const n = Math.max(labels.length,1);
    const start = kind==='inc' ? 170 : 330;
    const spread = kind==='inc' ? 120 : 90;
    return labels.map((_,i)=>{ const h=(start + (i*spread)/n)%360; const g=ctx.createLinearGradient(0,0,0,260); g.addColorStop(0,hsl(h,75,60)); g.addColorStop(1,hsl(h,75,42)); return g; });
  }
  const commonTooltip = { callbacks:{ label(c){ const v=Number(c.raw||0); const sum=(c.dataset.data||[]).reduce((s,x)=>s+Number(x||0),0)||1; const p=v/sum*100; return `${c.label}: ${fmtMoney(v)} (${nfPct.format(p)}%)`; } } };
  function upsertDoughnut(canvas, labels, values, total, kind){
    if(!canvas) return null; const prev=Chart.getChart(canvas); if(prev) prev.destroy();
    const ctx = canvas.getContext('2d'); const colors = catPalette(ctx, labels, kind);
    return new Chart(ctx,{ type:'doughnut', data:{ labels, datasets:[{ data:values, borderWidth:0, hoverOffset:8, cutout:'62%', backgroundColor:colors }] }, options:{ plugins:{ legend:{ display:false }, tooltip:commonTooltip }, animation:{ duration:900, easing:'easeOutQuart' } }, plugins:[donutCenter(()=>({ title:'Итого', line1:fmtMoney(total) }))] });
  }
  function upsertExpenseLine(canvas, labels, values, year, month){
    if(!canvas) return null; const ctx = canvas.getContext('2d'); const theme = getComputedStyle(document.documentElement);
    const line = (theme.getPropertyValue('--brand') || '#6a7dff').trim(); const g = ctx.createLinearGradient(0,0,0,300); g.addColorStop(0,'rgba(67,97,238,.35)'); g.addColorStop(1,'rgba(67,97,238,.05)');
    const prev = Chart.getChart(canvas); if(prev) prev.destroy();
    return new Chart(ctx,{ type:'line', data:{ labels, datasets:[{ data:values, fill:true, backgroundColor:g, borderColor:line, borderWidth:2.5, pointRadius:0, tension:.25 }] }, options:{ plugins:{ legend:{ display:false }, tooltip:{ mode:'index', intersect:false, callbacks:{ title(items){ const d=Number(items[0].label||'0'); const mm=String(month).padStart(2,'0'); const dd=String(d).padStart(2,'0'); return `${dd}.${mm}.${year}`; }, label(c){ return fmtMoney(c.parsed.y); } } } }, interaction:{ intersect:false, mode:'nearest' }, scales:{ x:{ grid:{ display:false }, ticks:{ maxRotation:0 } }, y:{ ticks:{ callback:v=> new Intl.NumberFormat('ru-RU').format(v) }, grid:{ color: theme.getPropertyValue('--stroke') || 'rgba(0,0,0,.1)' } } }, animation:{ duration:700 } } });
  }

  // ===== Obligations =====
  function isOverdue(dateISO, isDone){ if (isDone || !dateISO) return false; const d=new Date(dateISO); const today=new Date(); d.setHours(0,0,0,0); today.setHours(0,0,0,0); return d<today; }
  async function loadObligations(signal){
    const ym = $('#periodInput')?.value;
    const { data } = await api.get('/budget/obligations', { params:{ month: ym }, signal });
    const tbody = $('#obTable'); if(!tbody) return; tbody.innerHTML='';
    for (const r of data){
      const overdue = isOverdue(r.due_date, r.is_done);
      const tr = document.createElement('tr');
      tr.className = `ob-row ${r.is_done ? 'done':''} ${overdue ? 'overdue':''}`;
      tr.setAttribute('data-clickrow','1');
      tr.dataset.mode   = 'ob';
      tr.dataset.title  = r.title || '';
      tr.dataset.date   = fmtDate(r.due_date);
      tr.dataset.amount = fmtMoney(r.amount, r.currency);
      tr.dataset.status = r.is_done ? 'Оплачен' : (overdue ? 'Просрочен' : 'Запланирован');

      tr.innerHTML = `
        <td class="col-date" title="${fmtDate(r.due_date)}">${fmtDate(r.due_date)}</td>
        <td class="col-cat"  title="${r.title}"><span class="cell-clip">${r.title}</span></td>
        <td class="t-right col-sum" title="${fmtMoney(r.amount, r.currency)}">${fmtMoney(r.amount, r.currency)}</td>
        <td class="t-center">
          <input class="chk ob-done" type="checkbox" ${r.is_done ? 'checked':''}
                 data-id="${r.id}" data-date="${r.due_date || ''}"/>
        </td>
        <td class="t-right"><button class="btn btn-danger btn-sm" data-id="${r.id}" data-act="del">Удалить</button></td>`;
      tbody.appendChild(tr);
    }
  }

  // ===== Accounts & Categories =====
  async function loadAccountsAndCats(signal){
    ACCOUNTS = (await api.get('/budget/accounts', { signal })).data || [];
    const cats = (await api.get('/budget/categories', { signal })).data || [];
    CATS_IN = cats.filter(c=>c.kind==='income'); CATS_EX = cats.filter(c=>c.kind==='expense');
    MAP_ACC = Object.fromEntries(ACCOUNTS.map(a=>[a.id,a]));
    MAP_CAT = Object.fromEntries(cats.map(c=>[c.id,c]));
    fillAccountSelects(); fillCategoriesForModal(); renderCatTable();
  }
  function fillAccountSelects(){
    const acc=$('#m_acc'), contra=$('#m_contra'); if(!acc || !contra) return;
    acc.innerHTML=''; contra.innerHTML='';
    for (const a of ACCOUNTS){
      const title = `${a.title}${a.is_savings?' (накоп.)':''}`;
      acc.add(new Option(title, a.id));
      contra.add(new Option(title, a.id));
    }
  }
  const acctTitle = id => (MAP_ACC[id]?.title ? `${MAP_ACC[id].title}${MAP_ACC[id].is_savings?' (накоп.)':''}` : '—');
  const catName   = id => (MAP_CAT[id]?.name || '');

  // ===== Month transactions =====
  async function loadMonthTransactions(signal){
    const {from,to} = monthRange();
    const res = await api.get('/budget/transactions', { params:{ date_from:from, date_to:to, limit:500 }, signal });
    MONTH_TX = res.data || []; renderRecent(); renderLedger();
  }

  // ===== Recent table =====
  function renderRecent(){
    const tbody = $('#txTable'); if(!tbody) return; tbody.innerHTML='';
    const rows = [...MONTH_TX].sort((a,b)=> new Date(b.occurred_at) - new Date(a.occurred_at)).slice(0,50);
    for (const t of rows){
      const tr = document.createElement('tr');
      tr.setAttribute('data-clickrow','1');
      tr.dataset.type = humanType(t);
      tr.dataset.account = t.account_title ?? acctTitle(t.account_id);
      tr.dataset.desc = t.description ?? '';
      const cat = t.category_name ?? catName(t.category_id);
      tr.innerHTML = `
        <td class="col-date">${fmtDate(t.occurred_at)}</td>
        <td class="col-cat" title="${cat || ''}"><span class="cell-clip">${cat || '—'}</span></td>
        <td class="t-right col-sum">${fmtMoney(t.amount, t.currency ?? (MAP_ACC[t.account_id]?.currency ?? 'RUB'))}</td>
        <td class="t-hide-sm col-desc" title="${t.description ?? ''}"><span class="cell-clip">${t.description ?? ''}</span></td>`;
      tbody.appendChild(tr);
    }
  }

  // ===== Ledger =====
  function renderLedger(){
    const tab = document.querySelector('#ledgerTabs .tab-btn--active')?.dataset.tab || 'income';
    const incRows = MONTH_TX.filter(t=>t.type==='income');
    const expRows = MONTH_TX.filter(t=>t.type==='expense');

    function fill(sel, rows){
      const tbody = $(sel); if(!tbody) return 0;
      tbody.innerHTML=''; let sum=0;
      for (const t of rows){
        sum += Number(t.amount || 0);
        const cat = t.category_name ?? catName(t.category_id);
        const tr = document.createElement('tr');
        tr.setAttribute('data-clickrow','1');
        tr.dataset.type = humanType(t);
        tr.dataset.account = t.account_title ?? acctTitle(t.account_id);
        tr.dataset.desc = t.description ?? '';
        tr.innerHTML = `
          <td class="col-date">${fmtDate(t.occurred_at)}</td>
          <td class="col-cat" title="${cat || ''}"><span class="cell-clip">${cat || '—'}</span></td>
          <td class="t-right col-sum">${fmtMoney(t.amount, t.currency ?? (MAP_ACC[t.account_id]?.currency ?? 'RUB'))}</td>
          <td class="t-hide-sm col-desc" title="${t.description ?? ''}"><span class="cell-clip">${t.description ?? ''}</span></td>`;
        tbody.appendChild(tr);
      }
      return sum;
    }

    const s1 = fill('#incTable', incRows);
    const s2 = fill('#expTable', expRows);
    if (tab==='income'){
      $('#ledgerIncome')?.classList.add('visible'); $('#ledgerExpense')?.classList.remove('visible'); setText($('#tabTotal'), fmtMoney(s1));
    } else {
      $('#ledgerExpense')?.classList.add('visible'); $('#ledgerIncome')?.classList.remove('visible'); setText($('#tabTotal'), fmtMoney(s2));
    }
  }

  // ===== row expand =====
  document.addEventListener('click', (e)=>{
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;
    const tr = target.closest('tr[data-clickrow]');
    if (!tr) return;
    const inOb = !!tr.closest('#obTable');
    if (inOb && (target.closest('.ob-done') || target.closest('[data-act="del"]'))) return;
    const next = tr.nextElementSibling;
    if (next && next.classList?.contains('row-more')) { next.remove(); return; }
    const table = tr.closest('table');
    const ths = Array.from(table.querySelectorAll('thead th'));
    let cols = ths.filter(th => window.getComputedStyle(th).display !== 'none').length;
    if (!cols) cols = ths.length;
    const more = document.createElement('tr');
    more.className = 'row-more';
    if (inOb || tr.dataset.mode === 'ob'){
      more.innerHTML = `<td colspan="${cols}">
        <div class="row-more__box">
          <div><b>Название:</b> ${tr.dataset.title || '—'}</div>
          <div style="margin-top:6px"><b>Дата:</b> ${tr.dataset.date || '—'}</div>
          <div style="margin-top:6px"><b>Сумма:</b> ${tr.dataset.amount || '—'}</div>
          <div style="margin-top:6px"><b>Статус:</b> ${tr.dataset.status || '—'}</div>
        </div>
      </td>`;
    } else {
      const badgeClass =
        tr.dataset.type === 'Доход' ? 'pill--inc' :
        tr.dataset.type === 'Расход' ? 'pill--exp' : 'pill--tr';
      more.innerHTML = `<td colspan="${cols}">
        <div class="row-more__box">
          <div><b>Тип:</b> <span class="pill ${badgeClass}">${tr.dataset.type || '—'}</span></div>
          <div style="margin-top:6px"><b>Счёт:</b> ${tr.dataset.account || '—'}</div>
          <div style="margin-top:6px"><b>Описание:</b> ${tr.dataset.desc || '—'}</div>
        </div>
      </td>`;
    }
    tr.insertAdjacentElement('afterend', more);
  });

  // ===== Tabs =====
  $('#ledgerTabs')?.addEventListener('click', (e)=>{
    const t = e.target; if(!(t instanceof HTMLElement) || !t.classList.contains('tab-btn')) return;
    document.querySelectorAll('#ledgerTabs .tab-btn').forEach(b=>b.classList.remove('tab-btn--active'));
    t.classList.add('tab-btn--active'); renderLedger();
  });

  // ===== Categories =====
  let currentKind='income';
  $('#catTabs')?.addEventListener('click', (e)=>{
    const t = e.target; if(!(t instanceof HTMLElement) || !t.classList.contains('tab-btn')) return;
    document.querySelectorAll('#catTabs .tab-btn').forEach(b=>b.classList.remove('tab-btn--active'));
    t.classList.add('tab-btn--active'); currentKind = t.dataset.kind; renderCatTable();
  });
  function renderCatTable(){
    const rows = currentKind==='income' ? CATS_IN : CATS_EX;
    const tbody = $('#catTable'); if(!tbody) return; tbody.innerHTML='';
    for (const c of rows){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-cat" title="${c.name}"><span class="cell-clip">${c.name}</span></td>
        <td class="t-right">
          <button class="btn btn-danger btn-sm btn-del" data-id="${c.id}" data-act="del-cat">
            <span class="ico" aria-hidden="true">🗑</span><span class="txt">Удалить</span>
          </button>
        </td>`;
      tbody.appendChild(tr);
    }
  }
  $('#catTable')?.addEventListener('click', async (e)=>{
    const t = e.target; if(!(t instanceof HTMLElement)) return;
    const btn = t.closest('[data-act="del-cat"]');
    if (btn){
      const id = btn.getAttribute('data-id');
      try{ await api.delete(`/budget/categories/${id}`); await loadAccountsAndCats(activeAbort?.signal); renderCatTable(); await loadCharts(activeAbort?.signal); }
      catch(err){ alert(err?.response?.data?.detail || 'Нельзя удалить категорию (есть операции?)'); }
    }
  });

  // ===== Modals =====
  function openModal(sel, e){ e?.preventDefault(); e?.stopPropagation(); const m=$(sel); if(!m) return; m.removeAttribute('hidden'); m.style.removeProperty('display'); m.style.removeProperty('visibility'); m.style.removeProperty('opacity'); document.body.style.overflow='hidden'; }
  function closeModal(sel){ const m=$(sel); if(!m) return; m.setAttribute('hidden',''); m.style.removeProperty('display'); m.style.removeProperty('visibility'); m.style.removeProperty('opacity'); document.body.style.overflow=''; }
  $('#openOpModal')?.addEventListener('click', (e)=>{ fillAccountSelects(); fillCategoriesForModal(); const mDate=document.getElementById('m_date'); if (mDate) mDate.valueAsNumber = Date.now() - (new Date()).getTimezoneOffset()*60000; openModal('#opModal', e); });
  $('#openCatModal')?.addEventListener('click', (e)=> openModal('#catModal', e));
  document.querySelectorAll('.modal [data-close]')?.forEach(btn=> btn.addEventListener('click', ev=>{ const root=ev.currentTarget.closest('.modal'); if(root){ root.setAttribute('hidden',''); document.body.style.overflow=''; } }));
  window.addEventListener('keydown', ev=>{ if (ev.key==='Escape'){ document.querySelectorAll('.modal:not([hidden])').forEach(m=>m.setAttribute('hidden','')); document.body.style.overflow=''; } });

  // Operation modal
  function setModalType(t){
    modalType=t;
    document.querySelectorAll('#opmTabs .seg-btn').forEach(b=> b.classList.toggle('is-active', b.dataset.type===t));
    $('#m_contra_wrap')?.classList.toggle('hidden', modalType!=='transfer');
    $('#m_cat_wrap')?.classList.toggle('hidden', modalType==='transfer');
    fillCategoriesForModal();
  }
  $('#opmTabs')?.addEventListener('click', e=>{ const t=e.target; if(!(t instanceof HTMLElement) || !t.classList.contains('seg-btn')) return; setModalType(t.dataset.type); });
  function fillCategoriesForModal(){ const sel=$('#m_cat'); if(!sel) return; sel.innerHTML=''; const list=modalType==='income'?CATS_IN:CATS_EX; list.forEach(c=> sel.add(new Option(c.name, c.id))); }
  $('#opmForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    const payload = {
      type: modalType,
      occurred_at: $('#m_date').value || new Date().toISOString().slice(0,10),
      account_id: Number($('#m_acc').value),
      amount: Number($('#m_amount').value || '0'),
      description: $('#m_desc').value || null
    };
    if (modalType==='transfer') payload.contra_account_id = Number($('#m_contra').value);
    else payload.category_id = Number($('#m_cat').value);
    try{ await api.post('/budget/transactions', payload); closeModal('#opModal'); await refreshAll('op-submit'); }
    catch(err){ alert(err?.response?.data?.detail || 'Ошибка при добавлении операции'); }
  });

  // Category modal
  function setModalKind(k){ modalKind=k; document.querySelectorAll('#catmTabs .seg-btn').forEach(b=> b.classList.toggle('is-active', b.dataset.kind===k)); }
  $('#catmTabs')?.addEventListener('click', e=>{ const t=e.target; if(!(t instanceof HTMLElement) || !t.classList.contains('seg-btn')) return; setModalKind(t.dataset.kind); });
  $('#catmForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    const name = $('#catmName').value.trim(); if(!name) return;
    try{
      await api.post('/budget/categories', { kind: modalKind, name });
      $('#catmName').value=''; closeModal('#catModal');
      await loadAccountsAndCats(activeAbort?.signal); renderCatTable(); await loadCharts(activeAbort?.signal);
    }catch(err){ alert(err?.response?.data?.detail || 'Ошибка при добавлении категории'); }
  });

  // ===== Obligations actions =====
  async function addObligation(){
    const title = $('#obTitle')?.value.trim();
    const due_date = $('#obDate')?.value || null;
    const amount = Number($('#obAmount')?.value || '0');
    const currency = $('#obCurrency')?.value || 'RUB';
    if (!title || !amount) { alert('Укажи название и сумму'); return; }
    try{
      await api.post('/budget/obligations', { title, due_date, amount, currency });
      if ($('#obTitle')) $('#obTitle').value=''; if ($('#obDate')) $('#obDate').value=''; if ($('#obAmount')) $('#obAmount').value='';
      await loadObligations(activeAbort?.signal);
    }catch(err){ alert(err?.response?.data?.detail || 'Не удалось добавить платёж'); }
  }
  document.getElementById('addObBtn')?.addEventListener('click', addObligation);
  document.getElementById('obTable')?.addEventListener('click', async e=>{
    const btn = (e.target instanceof HTMLElement) ? e.target.closest('[data-act="del"]') : null; if (!btn) return;
    const id = btn.getAttribute('data-id'); if (!id) return;
    if (!confirm('Удалить платёж?')) return;
    try{ await api.delete(`/budget/obligations/${id}`); await loadObligations(activeAbort?.signal); }
    catch(err){ alert(err?.response?.data?.detail || 'Не удалось удалить платёж'); }
  });
  document.getElementById('obTable')?.addEventListener('change', async e=>{
    const chk = e.target; if (!(chk instanceof HTMLInputElement) || !chk.classList.contains('ob-done')) return;
    const id = chk.getAttribute('data-id'); const date = chk.getAttribute('data-date') || null;
    try{ await api.patch(`/budget/obligations/${id}`, { is_done: chk.checked, date }); await loadObligations(activeAbort?.signal); }
    catch(err){ alert(err?.response?.data?.detail || 'Не удалось изменить статус'); chk.checked = !chk.checked; }
  });

  // ===== Toggle all sections =====
  const toggleAllBtn = document.getElementById('toggleAllBtn');
  function anyOpen(){ return Array.from(document.querySelectorAll('details.collapsible')).some(d=>d.open); }
  function updateToggleAllBtn(){ if (!toggleAllBtn) return; const open=anyOpen(); toggleAllBtn.textContent=open?'⤵️ Все':'⤴️ Все'; toggleAllBtn.title=open?'Свернуть все секции':'Развернуть все секции'; toggleAllBtn.disabled=false; }
  toggleAllBtn?.addEventListener('click', ()=>{ const open=anyOpen(); document.querySelectorAll('details.collapsible').forEach(d=> d.open=!open); updateToggleAllBtn(); });
  updateToggleAllBtn();

  // ===== Portfolio total (from Investments) =====
  async function loadPortfolioTotal(signal){
    const card = document.getElementById('kpiPortfolioCard');
    const out  = document.getElementById('kpiPortfolioTotal');
    if (!card || !out) return;

    let total = null;
    const endpoints = [
      '/portfolio/summary', // ожидается { total_value }
      '/invest/summary',    // ожидается { total } или { total_value }
      '/portfolio/totals'   // запасной вариант
    ];

    for (const ep of endpoints){
      try {
        const { data } = await api.get(ep, { signal });
        total = data?.total_value ?? data?.total ?? null;
        if (total != null) break;
      } catch {}
    }

    if (total == null){
      const ls = localStorage.getItem('pf_portfolio_total');
      if (ls) total = Number(ls);
    }

    if (total != null){
      out.textContent = fmtMoney(total);
      card.hidden = false;
    } else {
      card.hidden = true;
    }
  }

  // ===== Refresh =====
  function scheduleNext(){ clearTimeout(timerId); timerId=setTimeout(()=>refreshAll('timer'), REFRESH_MS); }
  async function refreshAll(){
    if (isRefreshing) return; isRefreshing=true;
    if (activeAbort) activeAbort.abort(); activeAbort = new AbortController();
    const { signal } = activeAbort;
    const btn = document.getElementById('refreshBtn'); if(btn){ btn.disabled=true; btn.textContent='Обновляю...'; }
    try{
      await ping(signal);
      await loadAccountsAndCats(signal);
      await Promise.all([
        loadSummary(signal),
        loadCharts(signal),
        loadObligations(signal),
        loadMonthTransactions(signal),
        loadPortfolioTotal(signal) // << добавлено
      ]);
    }catch(err){ if(!axios.isCancel(err)) console.error('refresh error', err); }
    finally{ if(btn){ btn.disabled=false; btn.textContent='Обновить'; } isRefreshing=false; scheduleNext(); }
  }
  document.getElementById('refreshBtn')?.addEventListener('click', ()=>refreshAll());
  document.getElementById('periodInput')?.addEventListener('change', ()=>refreshAll());

  // ===== Summary =====
  async function loadSummary(signal){
    const {from,to} = monthRange();
    const { data } = await api.get('/budget/summary/month', { params:{ date_from:from, date_to:to }, signal });
    setText($('#kpiIncome'),  fmtMoney(data.income_total));
    setText($('#kpiExpense'), fmtMoney(data.expense_total));
    setText($('#kpiNet'),     fmtMoney(data.net_total));
    setText($('#kpiSavings'), fmtMoney(data.savings_transferred));
  }

  // ===== Charts load =====
  async function loadCharts(signal){
    const { from, to, days, year, month } = monthRange();
    const { data } = await api.get('/budget/summary/charts', { params:{ date_from:from, date_to:to }, signal });
    const inc = (data.income_by_category||[]).map(x=>({ name:x.name ?? x.category, amount:Number(x.amount||0) }));
    const exp = (data.expense_by_category||[]).map(x=>({ name:x.name ?? x.category, amount:Number(x.amount||0) }));
    const byDayRaw = (data.expense_by_day||[]).map(x=>({ name:String(x.name||x.d), amount:Number(x.amount||0) }));
    const mapByDay = {};
    for (const r of byDayRaw){
      const dd = /^\d{4}-\d{2}-\d{2}/.test(r.name) ? parseInt(r.name.slice(8,10),10) : parseInt(r.name,10);
      if (!Number.isNaN(dd)) mapByDay[dd]=(mapByDay[dd]||0)+r.amount;
    }
    const labels = Array.from({length:days}, (_,i)=> String(i+1).padStart(2,'0'));
    const series = labels.map(d=> mapByDay[parseInt(d,10)] || 0);
    const incTotal = inc.reduce((s,x)=>s+x.amount,0);
    const expTotal = exp.reduce((s,x)=>s+x.amount,0);
    upsertDoughnut($('#incChart'), inc.map(x=>x.name), inc.map(x=>x.amount), incTotal, 'inc');
    upsertDoughnut($('#expChart'), exp.map(x=>x.name), exp.map(x=>x.amount), expTotal, 'exp');
    upsertExpenseLine($('#expByDayChart'), labels, series, year, month);
  }

  // ===== init =====
  (async ()=>{
    const mDate = document.getElementById('m_date');
    if (mDate) mDate.valueAsNumber = Date.now() - (new Date()).getTimezoneOffset()*60000;
    setModalType('income'); setModalKind('income');
    await refreshAll();
  })();

  window.addEventListener('beforeunload', ()=>{ clearTimeout(timerId); if(activeAbort) activeAbort.abort(); });
})();
