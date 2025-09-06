if (window.Chart) { Chart.defaults.responsive = true; Chart.defaults.maintainAspectRatio = false; Chart.defaults.resizeDelay = 200; }
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
  const fmtMoney = (v, cur='RUB', d=2) => new Intl.NumberFormat('ru-RU', {style:'currency', currency:cur, maximumFractionDigits:d}).format(Number(v||0));
  const nfPct = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  const humanType = row => row.type==='income' ? 'Доход' : (row.type==='expense' ? 'Расход' : 'Перевод');

  // ===== tiny toast =====
  function toast(msg, type='ok', ms=2600){
    let wrap = document.querySelector('.toast-wrap');
    if(!wrap){ wrap = document.createElement('div'); wrap.className='toast-wrap'; document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type==='err' ? 'err' : 'ok');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(6px)'; setTimeout(()=>t.remove(), 380); }, ms);
  }

  // ===== Telegram/iOS top bar offset =====
  (function setTelegramTopOffset(){
    const ua = navigator.userAgent.toLowerCase();
    const isTg  = /telegram/i.test(navigator.userAgent);
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const extra = (isTg && isIOS) ? 44 : 0;
    document.documentElement.style.setProperty('--tg-top', extra + 'px');
  })();

  // ===== Theme =====
  function setTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('pf_theme', t); }
  (function initTheme(){ setTheme(localStorage.getItem('pf_theme') || 'dark'); })();

  // onThemeChanged — без лишних запросов: пересоздаём только инстансы чартов
  function onThemeChanged(){
    Object.keys(CHARTS).forEach(k=>{
      if (CHARTS[k]) { try{ CHARTS[k].destroy(); }catch(_){} CHARTS[k]=null; }
    });
    chartsObserved = false;
    observeChartsOnce();

    // если в кадре — перерисуем сразу
    if (CHART_DATA){
      ['incChart','expChart','expByDayChart'].forEach(id=>{
        const el = document.getElementById(id);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0){
          if (id==='incChart')  upsertDoughnutReusable('inc', el, CHART_DATA.inc.labels,  CHART_DATA.inc.values,  CHART_DATA.inc.total,  'inc');
          if (id==='expChart')  upsertDoughnutReusable('exp', el, CHART_DATA.exp.labels,  CHART_DATA.exp.values,  CHART_DATA.exp.total,  'exp');
          if (id==='expByDayChart'){ const L=CHART_DATA.line; upsertExpenseLineReusable('line', el, L.labels, L.values, L.year, L.month); }
        }
      });
    }
  }
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
  const REFRESH_MS = 360*1000;

  // фильтры
  let selectedLedgerCat = null;
  let selectedRecentCat = null;

  // ===== Charts helpers (PERF) =====
  const CHARTS = { inc: null, exp: null, line: null };
  let CHART_DATA = null;
  let chartsObserved = false;

  const donutCenter = (getInfo)=>({ id:'donutCenter', beforeDraw(chart){
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
  }});

  function hsl(h,s,l,a=1){ return `hsla(${h} ${s}% ${l}% / ${a})`; }
  function catPalette(ctx, labels, kind){
    const n = Math.max(labels.length,1);
    const start = kind==='inc' ? 170 : 330;
    const spread = kind==='inc' ? 120 : 90;
    return labels.map((_,i)=>{ const h=(start + (i*spread)/n)%360; const g=ctx.createLinearGradient(0,0,0,260); g.addColorStop(0,hsl(h,75,60)); g.addColorStop(1,hsl(h,75,42)); return g; });
  }
  const commonTooltip = { callbacks:{ label(c){ const v=Number(c.raw||0); const sum=(c.dataset.data||[]).reduce((s,x)=>s+Number(x||0),0)||1; const p=v/sum*100; return `${c.label}: ${fmtMoney(v)} (${nfPct.format(p)}%)`; } } };

  function upsertDoughnutReusable(key, canvas, labels, values, total, kind){
    if(!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (CHARTS[key]){
      const ch = CHARTS[key];
      ch.data.labels = labels;
      ch.data.datasets[0].data = values;
      ch.update();
      return ch;
    }
    const colors = catPalette(ctx, labels, kind);
    CHARTS[key] = new Chart(ctx,{
      type:'doughnut',
      data:{ labels, datasets:[{ data:values, borderWidth:0, hoverOffset:8, cutout:'62%', backgroundColor:colors }] },
      options:{ plugins:{ legend:{ display:false }, tooltip:commonTooltip }, animation:{ duration:600, easing:'easeOutQuart' } },
      plugins:[donutCenter(()=>({ title:'Итого', line1:fmtMoney(total) }))]
    });
    return CHARTS[key];
  }

  function upsertExpenseLineReusable(key, canvas, labels, values, year, month){
    if(!canvas) return null;
    const ctx = canvas.getContext('2d');
    const theme = getComputedStyle(document.documentElement);
    const line = (theme.getPropertyValue('--brand') || '#6a7dff').trim();
    const g = ctx.createLinearGradient(0,0,0,300); g.addColorStop(0,'rgba(67,97,238,.35)'); g.addColorStop(1,'rgba(67,97,238,.05)');

    if (CHARTS[key]){
      const ch = CHARTS[key];
      ch.data.labels = labels;
      ch.data.datasets[0].data = values;
      ch.options.plugins.tooltip.callbacks.title = (items)=>{
        const d=Number(items[0].label||'0'); const mm=String(month).padStart(2,'0'); const dd=String(d).padStart(2,'0');
        return `${dd}.${mm}.${year}`;
      };
      ch.update();
      return ch;
    }

    CHARTS[key] = new Chart(ctx,{
      type:'line',
      data:{ labels, datasets:[{ data:values, fill:true, backgroundColor:g, borderColor:line, borderWidth:2.5, pointRadius:0, tension:.25 }] },
      options:{
        plugins:{ legend:{ display:false }, tooltip:{ mode:'index', intersect:false, callbacks:{
          title(items){ const d=Number(items[0].label||'0'); const mm=String(month).padStart(2,'0'); const dd=String(d).padStart(2,'0'); return `${dd}.${mm}.${year}`; },
          label(c){ return fmtMoney(c.parsed.y); }
        } } },
        interaction:{ intersect:false, mode:'nearest' },
        scales:{ x:{ grid:{ display:false }, ticks:{ maxRotation:0 } },
                y:{ ticks:{ callback:v=> new Intl.NumberFormat('ru-RU').format(v) }, grid:{ color: theme.getPropertyValue('--stroke') || 'rgba(0,0,0,.1)' } } },
        animation:{ duration:500 }
      }
    });
    return CHARTS[key];
  }

  const ioCharts = new IntersectionObserver((ents)=>{
    ents.forEach(e=>{
      if (!e.isIntersecting || !CHART_DATA) return;
      if (e.target.id === 'incChart'){
        upsertDoughnutReusable('inc', e.target, CHART_DATA.inc.labels, CHART_DATA.inc.values, CHART_DATA.inc.total, 'inc');
      } else if (e.target.id === 'expChart'){
        upsertDoughnutReusable('exp', e.target, CHART_DATA.exp.labels, CHART_DATA.exp.values, CHART_DATA.exp.total, 'exp');
      } else if (e.target.id === 'expByDayChart'){
        const L = CHART_DATA.line;
        upsertExpenseLineReusable('line', e.target, L.labels, L.values, L.year, L.month);
      }
      ioCharts.unobserve(e.target);
    });
  });
  function observeChartsOnce(){
    if (chartsObserved) return;
    ['incChart','expChart','expByDayChart'].forEach(id=>{
      const el = document.getElementById(id);
      if (el) ioCharts.observe(el);
    });
    chartsObserved = true;
  }

  // ===== Obligations =====
  function isOverdue(dateISO, isDone){ if (isDone || !dateISO) return false; const d=new Date(dateISO); const today=new Date(); d.setHours(0,0,0,0); today.setHours(0,0,0,0); return d<today; }
  async function loadObligations(signal){
    const ym = $('#periodInput')?.value;
    const { data } = await api.get('/budget/obligations', { params:{ month: ym }, signal });
    const tbody = $('#obTable'); if(!tbody) return;

    let html = '';
    const totalsAll = {};
    const totalsLeft = {};

    for (const r of data){
      const overdue = isOverdue(r.due_date, r.is_done);
      const status = r.is_done ? 'Оплачен' : (overdue ? 'Просрочен' : 'Запланирован');
      const date = fmtDate(r.due_date);
      const sum  = fmtMoney(r.amount, r.currency);
      html += `
        <tr class="ob-row ${r.is_done ? 'done':''} ${overdue ? 'overdue':''}" data-clickrow="1"
            data-mode="ob" data-title="${r.title || ''}" data-date="${date}"
            data-amount="${sum}" data-status="${status}">
          <td class="col-date" title="${date}">${date}</td>
          <td class="col-cat"  title="${r.title}"><span class="cell-clip">${r.title}</span></td>
          <td class="t-right col-sum" title="${sum}">${sum}</td>
          <td class="t-center col-done">
            <input class="chk ob-done" type="checkbox" ${r.is_done ? 'checked':''}
                   data-id="${r.id}" data-date="${r.due_date || ''}"/>
          </td>
          <td class="t-right col-actions">
            <button class="btn btn-danger btn-sm btn-del" data-id="${r.id}" data-act="del" title="Удалить">
              <span class="ico" aria-hidden="true">🗑</span><span class="txt">Удалить</span>
            </button>
          </td>
        </tr>`;

      const cur = r.currency || 'RUB';
      const amt = Number(r.amount || 0) || 0;
      totalsAll[cur]  = (totalsAll[cur]  || 0) + amt;
      if (!r.is_done) totalsLeft[cur] = (totalsLeft[cur] || 0) + amt;
    }
    tbody.innerHTML = html;

    const fmtTotals = obj => {
      const parts = Object.entries(obj).map(([cur, sum]) => fmtMoney(sum, cur));
      return parts.length ? parts.join(' • ') : fmtMoney(0, 'RUB');
    };
    setText(document.getElementById('obTotalAll'),  fmtTotals(totalsAll));
    setText(document.getElementById('obTotalLeft'), fmtTotals(totalsLeft));
  }

  // ===== Accounts & Categories =====
  async function loadAccountsAndCats(signal){
    ACCOUNTS = (await api.get('/budget/accounts', { signal })).data || [];
    const cats = (await api.get('/budget/categories', { signal })).data || [];
    CATS_IN = cats.filter(c=>c.kind==='income'); CATS_EX = cats.filter(c=>c.kind==='expense');
    MAP_ACC = Object.fromEntries(ACCOUNTS.map(a=>[a.id,a]));
    MAP_CAT = Object.fromEntries(cats.map(c=>[c.id,c]));
    fillAccountSelects(); fillCategoriesForModal(); renderCatTable();
    rebuildCategoryFilters();
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

  // ===== UI helpers for small buttons near selects =====
  function injectAccountButtons(selectEl, baseId){
    if(!selectEl) return;
    if(!document.getElementById(baseId + '_add')){
      const btnAdd = document.createElement('button');
      btnAdd.id = baseId + '_add';
      btnAdd.type = 'button';
      btnAdd.className = 'btn btn-sm';
      btnAdd.style.marginLeft = '8px';
      btnAdd.textContent = '+ Счёт';
      selectEl.insertAdjacentElement('afterend', btnAdd);
      btnAdd.addEventListener('click', ()=> createAccountFlow(false));
    }
    if(!document.getElementById(baseId + '_del')){
      const btnDel = document.createElement('button');
      btnDel.id = baseId + '_del';
      btnDel.type = 'button';
      btnDel.className = 'btn btn-sm btn-danger';
      btnDel.style.marginLeft = '4px';
      btnDel.textContent = '– Счёт';
      selectEl.insertAdjacentElement('afterend', btnDel);
      btnDel.addEventListener('click', ()=> deleteAccountFlow());
    }
  }

  // ===== Перевод (используется KPI-кнопками/мастером накопит.) =====
  function openTransfer(withdraw){
    fillAccountSelects();
    setModalType('transfer');
    openModal('#opModal');

    const mainAcc    = ACCOUNTS.find(a=>!a.is_savings) || ACCOUNTS[0];
    const savingsAcc = ACCOUNTS.find(a=> a.is_savings) || ACCOUNTS[0];

    const accSel    = document.getElementById('m_acc');
    const contraSel = document.getElementById('m_contra');

    if (withdraw){
      if (savingsAcc) accSel.value    = String(savingsAcc.id);
      if (mainAcc)    contraSel.value = String(mainAcc.id);
    } else {
      if (mainAcc)    accSel.value    = String(mainAcc.id);
      if (savingsAcc) contraSel.value = String(savingsAcc.id);
    }

    const mDate=document.getElementById('m_date');
    if (mDate && !mDate.value) mDate.valueAsNumber = Date.now() - (new Date()).getTimezoneOffset()*60000;

    document.getElementById('m_amount')?.focus();
  }

  // ===== Savings wizard (когда нет накопительного) =====
  function openSavingsWizard(nextAction){
    const modal = document.getElementById('savingsWizard');
    if(!modal) return;
    modal.dataset.next = nextAction || '';
    modal.querySelector('#sw_title').value = 'Накопительный';
    modal.querySelector('#sw_currency').value = 'RUB';
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeSavingsWizard(){
    const modal = document.getElementById('savingsWizard');
    if(!modal) return;
    modal.setAttribute('hidden','');
    document.body.style.overflow = '';
  }
  (() => {
    const modal = document.getElementById('savingsWizard');
    if(!modal) return;
    modal.addEventListener('click', (e)=>{
      const el = e.target;
      if(!(el instanceof HTMLElement)) return;
      if(el.hasAttribute('data-close')) closeSavingsWizard();
    });
    document.getElementById('sw_submit')?.addEventListener('click', async ()=>{
      const title = document.getElementById('sw_title').value.trim() || 'Накопительный';
      const currency = document.getElementById('sw_currency').value || 'RUB';
      try{
        await api.post('/budget/accounts', { title, currency, is_savings:true });
        await loadAccountsAndCats(activeAbort?.signal);
        toast('Накопительный счёт создан');

        const next = document.getElementById('savingsWizard').dataset.next;
        closeSavingsWizard();

        if(next === 'topup')    openTransfer(false);
        if(next === 'withdraw') openTransfer(true);
      }catch(err){
        toast(err?.response?.data?.detail || 'Не удалось создать счёт', 'err', 3600);
      }
    });
  })();

  // ===== KPI «Накопительный счёт» — кнопки =====
  function injectTopUpButton(){
    const valEl = document.getElementById('kpiSavings'); if(!valEl) return;
    const card = valEl.closest('.kpi'); if(!card) return;

    let actions = document.getElementById('kpiSavingsActions');
    if (!actions){
      actions = document.createElement('div');
      actions.id = 'kpiSavingsActions';
      actions.className = 'kpi-actions';
      card.appendChild(actions);
    } else {
      actions.innerHTML = '';
    }

    const btnTopUp = document.createElement('button');
    btnTopUp.id = 'btnTopUpSavings';
    btnTopUp.type = 'button';
    btnTopUp.className = 'kpi-btn kpi-btn--primary';
    btnTopUp.title = 'Перевести с обычного счёта на накопительный';
    btnTopUp.innerHTML = '<span class="kpi-btn__ico">＋</span><span>Пополнить</span>';

    const btnWithdraw = document.createElement('button');
    btnWithdraw.id = 'btnWithdrawSavings';
    btnWithdraw.type = 'button';
    btnWithdraw.className = 'kpi-btn kpi-btn--danger';
    btnWithdraw.title = 'Перевести с накопительного счёта на обычный';
    btnWithdraw.innerHTML = '<span class="kpi-btn__ico">−</span><span>Снять</span>';

    actions.append(btnTopUp, btnWithdraw);

    btnTopUp.addEventListener('click', ()=>{
      const savingsAcc = ACCOUNTS.find(a=>a.is_savings);
      if(!savingsAcc){ openSavingsWizard('topup'); return; }
      openTransfer(false);
    });

    btnWithdraw.addEventListener('click', ()=>{
      const savingsAcc = ACCOUNTS.find(a=>a.is_savings);
      if(!savingsAcc){ openSavingsWizard('withdraw'); return; }
      openTransfer(true);
    });
  }

  // ===== Account create/delete — МОДАЛКИ =====
  function createAccountFlow(markSavings=false){
    // заполнить и открыть модалку создания
    const m = document.getElementById('accCreateModal'); if(!m) return;
    const title = document.getElementById('acc_title');
    const cur   = document.getElementById('acc_currency');
    const chk   = document.getElementById('acc_is_savings');
    title.value = markSavings ? 'Накопительный' : 'Основной';
    cur.value   = 'RUB';
    chk.checked = !!markSavings;
    openModal('#accCreateModal');
  }

  document.getElementById('accCreateForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const title = document.getElementById('acc_title').value.trim();
    const currency = document.getElementById('acc_currency').value;
    const is_savings = document.getElementById('acc_is_savings').checked;
    if(!title){ return; }
    try{
      await api.post('/budget/accounts', { title, currency, is_savings });
      document.querySelector('#accCreateModal [data-close]')?.click();
      await loadAccountsAndCats(activeAbort?.signal);
      fillAccountSelects();
      toast('Счёт создан');
    }catch(err){
      toast(err?.response?.data?.detail || 'Не удалось создать счёт', 'err', 3600);
    }
  });

  function deleteAccountFlow(){
    if (!ACCOUNTS.length){ toast('Нет счетов для удаления', 'err'); return; }
    // заполнить селект и открыть модалку
    const sel = document.getElementById('del_acc_select');
    sel.innerHTML = '';
    ACCOUNTS.forEach(a=>{
      const opt = new Option(`${a.title}${a.is_savings?' (накоп.)':''} — ${a.currency || 'RUB'}`, a.id);
      sel.add(opt);
    });
    document.getElementById('del_acc_confirm').checked = false;
    openModal('#accDeleteModal');
  }

  document.getElementById('accDeleteForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const id = document.getElementById('del_acc_select').value;
    const ok = document.getElementById('del_acc_confirm').checked;
    if(!ok || !id) return;
    try{
      await api.delete(`/budget/accounts/${id}`);
      document.querySelector('#accDeleteModal [data-close]')?.click();
      await loadAccountsAndCats(activeAbort?.signal);
      fillAccountSelects();
      toast('Счёт удалён');
    }catch(err){
      toast(err?.response?.data?.detail || 'Не удалось удалить счёт', 'err', 3600);
    }
  });

  // ===== Category dropdown helpers =====
  function buildCatItemsForLedger(){
    const tab = document.querySelector('#ledgerTabs .tab-btn--active')?.dataset.tab || 'income';
    const src = tab === 'income' ? CATS_IN : CATS_EX;
    return [{ value: '', label: 'Все категории' }, ...src.map(c => ({ value: String(c.id), label: c.name }))];
  }
  function buildCatItemsForRecent(){
    const src = [...CATS_IN, ...CATS_EX];
    return [{ value: '', label: 'Все категории' }, ...src.map(c => ({ value: String(c.id), label: c.name }))];
  }
  function renderDropdown(hostId, items, selectedVal, onChange){
    const host = document.getElementById(hostId);
    if (!host) return;
    const sel = items.find(i => String(i.value) === String(selectedVal)) || items[0];

    host.innerHTML = `
      <details class="dd">
        <summary class="dd__btn" role="button">${sel.label}</summary>
        <div class="dd__list">
          ${items.map(i => `
            <button type="button"
                    class="dd__opt ${String(i.value)===String(selectedVal) ? 'is-active' : ''}"
                    data-val="${i.value}">${i.label}</button>`).join('')}
        </div>
      </details>
    `;

    host.querySelectorAll('.dd__opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute('data-val') || '';
        onChange(v);
        renderDropdown(hostId, items, v, onChange);
        const dd = host.querySelector('details'); dd?.removeAttribute('open');
      });
    });
  }
  function rebuildCategoryFilters(){
    renderDropdown(
      'ledgerCatFilter',
      buildCatItemsForLedger(),
      selectedLedgerCat ?? '',
      v => { selectedLedgerCat = v || null; renderLedger(); }
    );
    renderDropdown(
      'recentCatFilter',
      buildCatItemsForRecent(),
      selectedRecentCat ?? '',
      v => { selectedRecentCat = v || null; renderRecent(); }
    );
  }

  // ===== Month transactions =====
  async function loadMonthTransactions(signal){
    const {from,to} = monthRange();
    const res = await api.get('/budget/transactions', { params:{ date_from:from, date_to:to, limit:500 }, signal });
    MONTH_TX = res.data || []; renderRecent(); renderLedger();
  }

  // ===== Recent table (batched) =====
  function resolveCategory(t){
    return (
      t.category_name ??
      t.category_title ??
      (t.category && t.category.name) ??
      t.category ??
      (t.category_id != null ? catName(t.category_id) : '')
    );
  }
  function renderRecent(){
    const tbody = $('#txTable'); if(!tbody) return;
    const wanted = selectedRecentCat ? Number(selectedRecentCat) : null;

    const rows = [...MONTH_TX]
      .filter(t => !wanted || Number(t.category_id) === wanted || Number(t?.category?.id) === wanted)
      .sort((a,b)=> new Date(b.occurred_at) - new Date(a.occurred_at))
      .slice(0,50);

    let html = '';
    for (const t of rows){
      const cat = resolveCategory(t);
      const sum = fmtMoney(t.amount, t.currency ?? (MAP_ACC[t.account_id]?.currency ?? 'RUB'));
      const date = fmtDate(t.occurred_at);
      const desc = t.description ?? '';
      const acc  = t.account_title ?? acctTitle(t.account_id);
      const type = humanType(t);
      html += `
        <tr data-clickrow="1" data-type="${type}" data-account="${acc}" data-desc="${desc}">
          <td class="col-date">${date}</td>
          <td class="col-cat" title="${cat || ''}"><span class="cell-clip">${cat || '—'}</span></td>
          <td class="t-right col-sum">${sum}</td>
          <td class="t-hide-sm col-desc" title="${desc}"><span class="cell-clip">${desc}</span></td>
        </tr>`;
    }
    tbody.innerHTML = html;
  }

  // ===== Ledger (batched) =====
  function renderLedger(){
    const tab = document.querySelector('#ledgerTabs .tab-btn--active')?.dataset.tab || 'income';
    const wanted = selectedLedgerCat ? Number(selectedLedgerCat) : null;

    const incRows = MONTH_TX
      .filter(t=>t.type==='income')
      .filter(t => !wanted || Number(t.category_id) === wanted || Number(t?.category?.id) === wanted);

    const expRows = MONTH_TX
      .filter(t=>t.type==='expense')
      .filter(t => !wanted || Number(t.category_id) === wanted || Number(t?.category?.id) === wanted);

    function fill(sel, rows){
      const tbody = $(sel); if(!tbody) return 0;
      let sum=0, html='';
      for (const t of rows){
        sum += Number(t.amount || 0);
        const cat = resolveCategory(t);
        const sumStr = fmtMoney(t.amount, t.currency ?? (MAP_ACC[t.account_id]?.currency ?? 'RUB'));
        const date = fmtDate(t.occurred_at);
        const desc = t.description ?? '';
        const acc  = t.account_title ?? acctTitle(t.account_id);
        const type = humanType(t);
        html += `
          <tr data-clickrow="1" data-type="${type}" data-account="${acc}" data-desc="${desc}">
            <td class="col-date">${date}</td>
            <td class="col-cat" title="${cat || ''}"><span class="cell-clip">${cat || '—'}</span></td>
            <td class="t-right col-sum">${sumStr}</td>
            <td class="t-hide-sm col-desc" title="${desc}"><span class="cell-clip">${desc}</span></td>
          </tr>`;
      }
      tbody.innerHTML = html;
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

  // ===== expandable rows =====
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
    t.classList.add('tab-btn--active');
    rebuildCategoryFilters();
    renderLedger();
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
      catch(err){ toast(err?.response?.data?.detail || 'Нельзя удалить категорию', 'err'); }
    }
  });

  // ===== Modals base =====
  function openModal(sel, e){ e?.preventDefault(); e?.stopPropagation(); const m=$(sel); if(!m) return; m.removeAttribute('hidden'); m.style.removeProperty('display'); m.style.removeProperty('visibility'); m.style.removeProperty('opacity'); document.body.style.overflow='hidden'; }
  function ensureAccountButtonsNearSelects(){
    injectAccountButtons(document.getElementById('m_acc'),    'acc1');
    injectAccountButtons(document.getElementById('m_contra'), 'acc2');
  }
  document.getElementById('openOpModal')?.addEventListener('click', ensureAccountButtonsNearSelects);
  function closeModal(sel){ const m=$(sel); if(!m) return; m.setAttribute('hidden',''); m.style.removeProperty('display'); m.style.removeProperty('visibility'); m.style.removeProperty('opacity'); document.body.style.overflow=''; }
  const openOpModalFlow = (e)=>{ fillAccountSelects(); fillCategoriesForModal(); const mDate=document.getElementById('m_date'); if (mDate) mDate.valueAsNumber = Date.now() - (new Date()).getTimezoneOffset()*60000; openModal('#opModal', e); };
  $('#openOpModal')?.addEventListener('click', (e)=> openOpModalFlow(e));
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
    catch(err){ toast(err?.response?.data?.detail || 'Ошибка при добавлении операции', 'err'); }
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
    }catch(err){ toast(err?.response?.data?.detail || 'Ошибка при добавлении категории', 'err'); }
  });

  // ===== Obligations actions =====
  async function addObligation(){
    const title = $('#obTitle')?.value.trim();
    const due_date = $('#obDate')?.value || null;
    const amount = Number($('#obAmount')?.value || '0');
    const currency = $('#obCurrency')?.value || 'RUB';
    if (!title || !amount) { toast('Укажи название и сумму','err'); return; }
    try{
      await api.post('/budget/obligations', { title, due_date, amount, currency });
      if ($('#obTitle')) $('#obTitle').value=''; if ($('#obDate')) $('#obDate').value=''; if ($('#obAmount')) $('#obAmount').value='';
      await loadObligations(activeAbort?.signal);
    }catch(err){ toast(err?.response?.data?.detail || 'Не удалось добавить платёж','err'); }
  }
  document.getElementById('addObBtn')?.addEventListener('click', addObligation);
  document.getElementById('obTable')?.addEventListener('click', async e=>{
    const btn = (e.target instanceof HTMLElement) ? e.target.closest('[data-act="del"]') : null; if (!btn) return;
    const id = btn.getAttribute('data-id'); if (!id) return;
    if (!confirm('Удалить платёж?')) return;
    try{ await api.delete(`/budget/obligations/${id}`); await loadObligations(activeAbort?.signal); }
    catch(err){ toast(err?.response?.data?.detail || 'Не удалось удалить платёж','err'); }
  });
  document.getElementById('obTable')?.addEventListener('change', async e=>{
    const chk = e.target; if (!(chk instanceof HTMLInputElement) || !chk.classList.contains('ob-done')) return;
    const id = chk.getAttribute('data-id'); const date = chk.getAttribute('data-date') || null;
    try{ await api.patch(`/budget/obligations/${id}`, { is_done: chk.checked, date }); await loadObligations(activeAbort?.signal); }
    catch(err){ toast(err?.response?.data?.detail || 'Не удалось изменить статус','err'); chk.checked = !chk.checked; }
  });

  // ===== Toggle all sections =====
  const toggleAllBtn = document.getElementById('toggleAllBtn');
  const listDetails = () => Array.from(document.querySelectorAll('details.collapsible:not(.kpi-block)'));
  function anyOpen(){ return listDetails().some(d=>d.open); }
  function updateToggleAllBtn(){
    if (!toggleAllBtn) return;
    const open=anyOpen();
    toggleAllBtn.textContent=open?'⤵️ Все':'⤴️ Все';
    toggleAllBtn.title=open?'Свернуть все секции':'Развернуть все секции';
    toggleAllBtn.disabled=false;
  }
  toggleAllBtn?.addEventListener('click', ()=>{
    const open=anyOpen();
    listDetails().forEach(d=> d.open=!open);
    updateToggleAllBtn();
  });
  updateToggleAllBtn();

  // ===== Summary (KPI) =====
  async function loadSummary(signal){
    const {from,to} = monthRange();
    const { data } = await api.get('/budget/summary/month', { params:{ date_from:from, date_to:to }, signal });
    setText($('#kpiIncome'),  fmtMoney(data.income_total));
    setText($('#kpiExpense'), fmtMoney(data.expense_total));
    setText($('#kpiNet'),     fmtMoney(data.net_total));
    setText($('#kpiSavings'), fmtMoney((data.savings ?? data.savings_transferred) || 0));

    try {
      const pt  = Number(localStorage.getItem('pf_portfolio_total') || '');
      const cur = localStorage.getItem('pf_portfolio_currency') || 'RUB';
      const card = document.getElementById('kpiPortfolioCard');
      if (pt && isFinite(pt)) {
        setText(document.getElementById('kpiPortfolioTotal'), fmtMoney(pt, cur));
        card?.removeAttribute('hidden');
      } else {
        card?.setAttribute('hidden','');
      }
    } catch(_) { /* no-op */ }
  }

  // ===== Charts load (PERF) =====
  async function loadCharts(signal){
    const { from, to, days, year, month } = monthRange();
    const { data } = await api.get('/budget/summary/charts', { params:{ date_from:from, date_to:to }, signal });

    const inc = (data.income_by_category||[]).map(x=>({ name:(x.name ?? x.category), amount:Number(x.amount||0) }));
    const exp = (data.expense_by_category||[]).map(x=>({ name:(x.name ?? x.category), amount:Number(x.amount||0) }));

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

    CHART_DATA = {
      inc:  { labels: inc.map(x=>x.name), values: inc.map(x=>x.amount), total: incTotal },
      exp:  { labels: exp.map(x=>x.name), values: exp.map(x=>x.amount), total: expTotal },
      line: { labels, values: series, year, month }
    };

    observeChartsOnce();
    ['incChart','expChart','expByDayChart'].forEach(id=>{
      const el = document.getElementById(id);
      if (!el || !CHART_DATA) return;
      const r = el.getBoundingClientRect();
      const inView = r.top < window.innerHeight && r.bottom > 0;
      if (inView){
        if (id==='incChart')  upsertDoughnutReusable('inc', el, CHART_DATA.inc.labels,  CHART_DATA.inc.values,  CHART_DATA.inc.total,  'inc');
        if (id==='expChart')  upsertDoughnutReusable('exp', el, CHART_DATA.exp.labels,  CHART_DATA.exp.values,  CHART_DATA.exp.total,  'exp');
        if (id==='expByDayChart'){ const L=CHART_DATA.line; upsertExpenseLineReusable('line', el, L.labels, L.values, L.year, L.month); }
      }
    });
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
      await Promise.all([loadSummary(signal), loadCharts(signal), loadObligations(signal), loadMonthTransactions(signal)]);
      rebuildCategoryFilters();
    }catch(err){ if(!axios.isCancel(err)) console.error('refresh error', err); }
    finally{ if(btn){ btn.disabled=false; btn.textContent='Обновить'; } isRefreshing=false; scheduleNext(); }
  }
  document.getElementById('refreshBtn')?.addEventListener('click', ()=>refreshAll());

  // троттлинг смены периода
  let _periodT;
  document.getElementById('periodInput')?.addEventListener('change', ()=>{
    clearTimeout(_periodT);
    _periodT = setTimeout(()=>refreshAll(), 60);
  });

  // ====== HELP MODAL + HOTKEYS ======
  function openHelp(){ openModal('#helpModal'); }
  document.getElementById('helpBtn')?.addEventListener('click', openHelp);

  function focusSearch(){ const el = document.getElementById('searchInput'); if(el){ el.focus(); el.select?.(); } }

  document.addEventListener('keydown', (e)=>{
    const activeModalOpen = !!document.querySelector('.modal:not([hidden])');
    const tag = (e.target?.tagName || '').toLowerCase();
    const typing = tag==='input' || tag==='textarea' || e.target?.isContentEditable;

    if (e.key === '/') { if(!typing && !activeModalOpen){ e.preventDefault(); focusSearch(); } return; }
    if (typing || activeModalOpen) return;

    const k = e.key.toLowerCase();
    if (k === 'r'){ e.preventDefault(); refreshAll(); }
    if (k === 't'){ e.preventDefault(); const btn=document.getElementById('themeToggle'); btn?.click(); }
    if (k === 's'){ e.preventDefault(); document.getElementById('toggleAllBtn')?.click(); }
    if (k === 'a'){ e.preventDefault(); openOpModalFlow(); }
    if (e.key === '?' || (e.shiftKey && e.key === '/')){ e.preventDefault(); openHelp(); }
  });

  // ===== init =====
  (async ()=>{
    const mDate = document.getElementById('m_date');
    if (mDate) mDate.valueAsNumber = Date.now() - (new Date()).getTimezoneOffset()*60000;
    setModalType('income'); setModalKind('income');

    // ленивые графики включаем сразу
    observeChartsOnce();

    await refreshAll();
    injectTopUpButton();
  })();

  window.addEventListener('beforeunload', ()=>{ clearTimeout(timerId); if(activeAbort) activeAbort.abort(); });
})();
