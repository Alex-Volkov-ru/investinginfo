// ====== CONFIG ======
  const BACKEND =
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://127.0.0.1:8000'
      : '/api';

  Chart.defaults.font.family = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;

  // ====== STATE ======
  let auth = { token:null, userId:null, email:null, portfolioId:null };
  let portfolio = { savings:[], stocks:[], bonds:[], funds:[], history:[] };
  const charts = {};
  let collapsedMap = { stocks:true, bonds:true, funds:true, savings:true };
  let searchQuery = '';
  let fp;
  let quotesTimer = null;
  let isAnyChartOpen = false;
  let isRefreshing = false;

  // ====== TOAST ======
  function toast(msg, type='ok'){
    const wrap = document.getElementById('toastWrap');
    const el = document.createElement('div');
    el.className = 'toast ' + (type==='err'?'err':'ok');
    el.innerHTML = `<div>${msg}</div>`;
    wrap.appendChild(el);
    setTimeout(()=>{ el.style.opacity=.0; el.style.transform='translateY(6px)'; }, 2400);
    setTimeout(()=>{ el.remove(); }, 2800);
  }

  // ====== PERSIST ======
  function saveLocal(){ try{ localStorage.setItem('pf_data', JSON.stringify(portfolio)); }catch(_){} }
  function loadLocal(){ try{ const j = localStorage.getItem('pf_data'); if(j) portfolio = JSON.parse(j); }catch(_){} }

  function saveAuth(){
    localStorage.setItem('pf_token', auth.token || '');
    localStorage.setItem('pf_user_id', auth.userId || '');
    localStorage.setItem('pf_email', auth.email || '');
    localStorage.setItem('pf_portfolio_id', auth.portfolioId || '');
    applyAuthUi();
  }
  function loadAuth(){
    auth.token = localStorage.getItem('pf_token') || null;
    auth.userId = Number(localStorage.getItem('pf_user_id') || '') || null;
    auth.email  = localStorage.getItem('pf_email') || null;
    auth.tg_username = localStorage.getItem('pf_tg_username') || null; 
    auth.portfolioId = Number(localStorage.getItem('pf_portfolio_id') || '') || null;
  }
  function clearAuth(){
    auth = { token:null, userId:null, email:null, portfolioId:null, tg_username:null };
    localStorage.removeItem('pf_token');
    localStorage.removeItem('pf_user_id');
    localStorage.removeItem('pf_email');
    localStorage.removeItem('pf_portfolio_id');
    localStorage.removeItem('pf_tg_username');
    applyAuthUi();
  }

  function saveCollapsed(){ try{ localStorage.setItem('pf_collapsed', JSON.stringify(collapsedMap)); }catch(_){} }
  function loadCollapsed(){ try{ const j = localStorage.getItem('pf_collapsed'); if(j){ collapsedMap = JSON.parse(j); } }catch(_){} }
  function saveSearch(){ try{ localStorage.setItem('pf_search', searchQuery); }catch(_){} }
  function loadSearch(){ try{ const s = localStorage.getItem('pf_search') || ''; searchQuery = s; const si = document.getElementById('searchInput'); if(si) si.value = s; }catch(_){} }

  // ====== UI ======
  function applyTitle(t){
    document.getElementById('portfolioTitle').textContent = t || '✨ Мой портфель';
    document.getElementById('pageTitle').textContent = (t || 'Мой инвестиционный портфель');
  }
  function loadTitle(){
    const t = localStorage.getItem('pf_title') || '✨ Мой портфель';
    applyTitle(t);
  }

  function applyAuthUi(){
    const st = document.getElementById('authStatus');
    const btnOut = document.getElementById('logoutBtn');
    if(auth.token && (auth.tg_username || auth.email)){
      st.textContent = `Привет, ${auth.tg_username || auth.email}`;
      btnOut.style.display = '';
    }else{
      st.textContent = 'Гость';
      btnOut.style.display = 'none';
    }
  }

  // ====== THEME ======
  function setTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem('pf_theme', t); renderCharts(); }
  function initTheme(){ const t = localStorage.getItem('pf_theme') || 'light'; setTheme(t); }

  // ====== DATEPICKER ======
  function initDatePicker(){
    if(fp) fp.destroy();
    fp = flatpickr('#assetDate', {
      locale: flatpickr.l10ns.ru,
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd.m.Y',
      allowInput: true,
      defaultDate: new Date()
    });
  }

  // ====== AXIOS ======
  const api = axios.create({ baseURL: BACKEND, timeout: 20000 });
  api.interceptors.request.use(cfg=>{
    if(auth.token){
      cfg.headers = cfg.headers || {};
      cfg.headers['Authorization'] = `Bearer ${auth.token}`;
    }
    return cfg;
  });

  /* === НОВОЕ: статус InvestAPI и модалка === */
  async function apiGetMe(){
    try{ const { data } = await api.get('/users/me'); return data; }catch{ return null; }
  }
  function setApiIndicator(on){
    const dot = document.getElementById('apiStatusDot');
    if(dot) dot.style.background = on ? 'var(--ok)' : '#888';
    const btn = document.getElementById('apiStatusBtn');
    if(btn) btn.title = on ? 'API подключено' : 'API не подключено';
  }
  async function refreshApiIndicator(){
    const me = await apiGetMe();
    setApiIndicator(!!(me && me.has_tinkoff));
    const authEl = document.getElementById('authStatus');
    if(authEl && me) authEl.textContent = me.email || authEl.textContent;
  }
  function hookTokenModal(){
    const tokenModal = document.getElementById('tokenModal');
    const openBtn = document.getElementById('apiStatusBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const clearBtn = document.getElementById('modalClearBtn');
    const saveBtn = document.getElementById('modalSaveBtn');
    const input = document.getElementById('modalTinkoffToken');

    if(openBtn){
      openBtn.addEventListener('click', ()=>{
        if(!auth.token){ toast('Сначала войдите', 'err'); return; }
        input.value = '';
        tokenModal.style.display = 'flex';
      });
    }
    if(cancelBtn){
      cancelBtn.addEventListener('click', ()=> tokenModal.style.display = 'none');
    }
    if(clearBtn){
      clearBtn.addEventListener('click', async ()=>{
        if(!confirm('Очистить сохранённый токен? Доступ к API будет отключён.')) return;
        try{
          await api.put('/users/me/token', { tinkoff_token: null });
          await refreshApiIndicator();
          tokenModal.style.display = 'none';
          toast('Токен очищен');
        }catch(e){
          toast(e?.response?.data?.detail || 'Ошибка при очистке', 'err');
        }
      });
    }
    if(saveBtn){
      saveBtn.addEventListener('click', async ()=>{
        const val = (input.value || '').trim();
        if(!val){ toast('Введите токен или нажмите «Очистить»', 'err'); return; }
        if(!/^t\./i.test(val)){
          if(!confirm('Токен не начинается с "t." — всё равно сохранить?')) return;
        }
        try{
          await api.put('/users/me/token', { tinkoff_token: val });
          await refreshApiIndicator();
          tokenModal.style.display = 'none';
          toast('Токен сохранён');
        }catch(e){
          toast(e?.response?.data?.detail || 'Ошибка при сохранении', 'err');
        }
      });
    }
  }
  /* === КОНЕЦ блока InvestAPI === */

  // --- Portfolio API ---
  async function apiListPortfolios(){ const { data } = await api.get('/portfolio'); return data || []; }
  async function apiCreatePortfolio(){ const { data } = await api.post('/portfolio', { title:'Основной', type:'broker', currency:'RUB' }); return data; }
  async function apiListPositionsFull(pfId){ const { data } = await api.get(`/portfolio/${pfId}/positions/full`); return data || []; }
  async function apiDeletePosition(positionId){ await api.delete(`/portfolio/positions/${positionId}`); }
  async function apiUpsertPositionByFigi({ portfolio_id, figi, ticker, class_hint, qty, avg, name, currency, nominal }){
    const payload = {
      portfolio_id, figi, ticker: (ticker || '').toUpperCase(), class_hint: class_hint || null,
      quantity: Number(qty) || 0, avg_price: Number(avg) || 0, name: name || null, currency: currency || null, nominal: nominal ?? null
    };
    const { data } = await api.post('/portfolio/positions', payload);
    return data;
  }

  // ====== MARKET HELPERS ======
  async function apiResolve(ticker, classHint=null){
    const { data } = await api.get('/resolve', { params: { ticker } });
    const hit = (data?.results && data.results[0]) ? data.results[0] : null;
    if(!hit) throw new Error('Не найден FIGI для этого тикера');
    return hit;
  }
  async function apiBatchQuotes(tickers, classHint=null){
    const payload = { tickers }; if(classHint) payload.class_hint = classHint;
    const { data } = await api.post('/quotes_by_tickers', payload);
    return data.results || [];
  }
  async function apiCandles(figi, interval='1d', fromISO=null, toISO=null){
    try{
      const params = { interval };
      if(fromISO) params.from_ = fromISO;
      if(toISO) params.to = toISO;
      const { data } = await api.get(`/candles/${figi}`, { params });
      return data;
    }catch(err){
      console.warn('candles error', err); toast('Нет данных для выбранного периода', 'err'); return [];
    }
  }

  // ====== LOAD FROM DB ======
  async function loadFromDB(){
    let pfs = await apiListPortfolios();
    if(!pfs.length){ const created = await apiCreatePortfolio(); pfs = [created]; }
    const pf = pfs[0];
    auth.portfolioId = pf.id; saveAuth();
    const rows = await apiListPositionsFull(pf.id);
    const hist = portfolio.history || [];
    portfolio = { savings:[], stocks:[], bonds:[], funds:[], history: hist };
    for(const pos of rows){
      const inst = pos.instrument || {};
      const cls = inst.class || 'share';
      const bucket = (cls==='share') ? 'stocks' : (cls==='bond' ? 'bonds' : (cls==='etf' ? 'funds' : 'stocks'));
      const ticker = (inst.ticker || '').toUpperCase();
      const avg = Number(pos.avg_price)||0;
      const qty = Number(pos.quantity)||0;
      portfolio[bucket].push({
        posId: pos.id, figi: pos.figi, name: ticker || pos.figi, ticker, class: cls, currency: inst.currency || null,
        nominal: inst.nominal ?? null,
        displayName: (inst.name && ticker) ? `${inst.name} (${ticker})` : (inst.name || ticker || pos.figi),
        quantity: qty, avgPrice: avg, currentPrice: null, value: avg*qty, pnlAbs: 0, pnlPct: 0, date: null
      });
    }
  }

  // ====== UTILS ======
  const nf0 = new Intl.NumberFormat('ru-RU',{ maximumFractionDigits:0 });
  const nf2 = new Intl.NumberFormat('ru-RU',{ maximumFractionDigits:2 });
  const fmt = (n,d=2)=> isFinite(n) ? (d===0? nf0.format(n) : nf2.format(n)) : '0';
  const cssId = s => (s||'').toString().replace(/[^a-z0-9]/gi,'_');
  function totalValue(){ return ['savings','stocks','bonds','funds'].reduce((s,k)=> s + (portfolio[k]||[]).reduce((a,i)=>a+(i.value||0),0), 0); }
  function pushHistory(){ portfolio.history.push({ t: Date.now(), total: totalValue() }); if(portfolio.history.length>600) portfolio.history.shift(); saveLocal(); }
  function fmtISOtoRU(iso){ if(!iso) return '—'; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); if(!m) return iso; return `${m[3]}.${m[2]}.${m[1]}`; }
  function toISOFromAlt(inputVal){ const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(inputVal.trim()); if(!m) return null; return `${m[3]}-${m[2]}-${m[1]}`; }
  function animateNumbers(){
    document.querySelectorAll('[data-anim-num]')?.forEach(el=>{
      const to = Number(el.getAttribute('data-anim-num')||0);
      const dur = 700; const t0 = performance.now();
      const step = (t)=>{ const p = Math.min(1, (t-t0)/dur); const v = to*p; el.textContent = `${fmt(v)} ₽`; if(p<1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }
  function totalPL(){
    const cats = ['stocks','bonds','funds'];
    let abs=0, base=0;
    for(const c of cats){
      for(const it of (portfolio[c]||[])){
        const cp = it.currentPrice ?? it.avgPrice ?? 0;
        const qty = it.quantity||0;
        const avg = it.avgPrice||0;
        const nowVal = cp*qty;
        const cost = avg*qty;
        abs += (avg>0 ? (nowVal - cost) : 0);
        base += cost;
      }
    }
    const pct = base>0 ? abs/base*100 : 0;
    return {abs, pct};
  }
  function escHtml(s=''){
    return (s+'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }
  function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function highlightMatch(text, q){
    if(!q) return escHtml(text||'');
    const re = new RegExp('('+escapeRegExp(q)+')','ig');
    return escHtml(text||'').replace(re,'<mark>$1</mark>');
  }

  // ====== RENDER: SUMMARY ======
  function buildClassBreakdownHint(){
    const blocks = [
      ['Накопит', (portfolio.savings||[]).reduce((s,i)=>s+i.value,0)],
      ['Акции', (portfolio.stocks||[]).reduce((s,i)=>s+((i.currentPrice??i.avgPrice??0)*(i.quantity||0)),0)],
      ['ОФЗ', (portfolio.bonds||[]).reduce((s,i)=>s+((i.currentPrice??i.avgPrice??0)*(i.quantity||0)),0)],
      ['Фонды', (portfolio.funds||[]).reduce((s,i)=>s+((i.currentPrice??i.avgPrice??0)*(i.quantity||0)),0)]
    ];
    const total = blocks.reduce((a,b)=>a+b[1],0) || 1;
    return blocks.map(([label,val])=> `${label}: ${fmt(val)} ₽  (${fmt(val/total*100)}%)`).join('\n');
  }
  function topInsideHint(arr){
    const rows = (arr||[]).map(i=>({ name: (i.displayName||i.name||i.ticker||'').toString(), v: ((i.currentPrice??i.avgPrice??0)*(i.quantity||0)) }))
      .sort((a,b)=>b.v-a.v).slice(0,6);
    if(!rows.length) return 'Нет позиций';
    return rows.map(r=> `${r.name}: ${fmt(r.v)} ₽`).join('\n');
  }

  function renderSummary(){
    const blocks = [
      { key:'total', title:'Всего', val: totalValue(), hint: buildClassBreakdownHint() },
      { key:'savings', title:'Накопит. счёт', val: (portfolio.savings||[]).reduce((s,i)=>s+i.value,0), hint: topInsideHint(portfolio.savings) },
      { key:'stocks', title:'Акции', val: (portfolio.stocks||[]).reduce((s,i)=>s+((i.currentPrice??i.avgPrice??0)*(i.quantity||0)),0), hint: topInsideHint(portfolio.stocks) },
      { key:'bonds', title:'ОФЗ', val: (portfolio.bonds||[]).reduce((s,i)=>s+((i.currentPrice??i.avgPrice??0)*(i.quantity||0)),0), hint: topInsideHint(portfolio.bonds) },
      { key:'funds', title:'Фонды', val: (portfolio.funds||[]).reduce((s,i)=>s+((i.currentPrice??i.avgPrice??0)*(i.quantity||0)),0), hint: topInsideHint(portfolio.funds) },
    ];
    const wrap = document.getElementById('portfolioSummary');
    wrap.innerHTML = blocks.map(b=>`
      <div class="summary-card animate-in" data-hint="${escHtml(b.hint)}">
        <div class="summary-title">${b.title}</div>
        <div class="summary-num" data-anim-num="${b.val}">0 ₽</div>
      </div>`).join('');
    animateNumbers();
  }

  function displayLabel(it){
    if (it.displayName) return it.displayName;
    if (it.name && it.ticker) return `${it.name} (${it.ticker})`;
    return it.name || it.ticker || '';
  }

  function destroyPerAssetCharts(){
    Object.keys(charts).forEach(key=>{
      if(key.startsWith('canvas-') && charts[key] && typeof charts[key].destroy==='function'){
        charts[key].destroy();
        delete charts[key];
      }
    });
  }

  // ====== RENDER: SECTIONS ======
  function renderSections(){
    const wrap = document.getElementById('portfolioSections');
    destroyPerAssetCharts();
    wrap.innerHTML = '';

    const groups = [
      ['stocks','Акции'],
      ['bonds','ОФЗ/Облигации'],
      ['funds','Фонды/ETF'],
      ['savings','Накопительный счёт']
    ];

    const query = (searchQuery||'').trim().toLowerCase();

    for(const [cat,label] of groups){
      const allItems = portfolio[cat]||[];
      const items = query
        ? allItems.filter(it => {
            const t = (displayLabel(it)||'').toLowerCase();
            const tick = (it.ticker||'').toLowerCase();
            return t.includes(query) || tick.includes(query);
          })
        : allItems;

      if(!allItems.length) continue;
      const open = query ? true : !collapsedMap[cat];

      const listHTML = items.length ? items.map((it,idx)=>{
        if(cat==='savings'){
          return `
          <div class="asset-card animate-in">
            <div class="asset-header">
              <div class="asset-name">${highlightMatch('Пополнение', query)}</div>
              <div class="asset-actions">
                <button class="btn btn-danger" data-action="del" data-type="${cat}" data-index="${idx}">Удалить</button>
              </div>
            </div>
            <div class="asset-details" style="grid-template-columns:repeat(2,1fr)">
              <div>Сумма: <b>${fmt(it.value)} ₽</b></div>
              <div>Дата: <b>${fmtISOtoRU(it.date)}</b></div>
            </div>
          </div>`;
        }
        const id = cssId(it.name);
        const curPrice = it.currentPrice ?? it.avgPrice ?? 0;
        const curVal = curPrice * (it.quantity||0);
        const pnlAbs = it.avgPrice ? (curPrice - it.avgPrice) * it.quantity : 0;
        const pnlPct = it.avgPrice ? ((curPrice - it.avgPrice)/it.avgPrice*100) : 0;
        const pnlColor = pnlAbs >= 0 ? 'color:var(--ok)' : 'color:var(--accent)';
        const title = highlightMatch(displayLabel(it) || it.name, query);
        return `
        <div class="asset-card animate-in">
          <div class="asset-header">
            <div class="asset-name">${title} ${it.figi?`<small style="color:var(--muted)">(${it.figi})</small>`:''}</div>
            <div class="asset-actions">
              <button class="btn" data-action="show" data-name="${it.name}" title="Показать/скрыть график">📈 График</button>
              <button class="btn" data-action="edit" data-type="${cat}" data-index="${idx}">✏️ Изменить</button>
              <button class="btn btn-danger" data-action="del" data-type="${cat}" data-index="${idx}">Удалить</button>
            </div>
          </div>
          <div class="asset-details">
            <div>Кол-во: <b>${fmt(it.quantity,0)}</b></div>
            <div>Цена ср.: <b>${fmt(it.avgPrice)} ₽</b></div>
            <div>Тек. цена: <b>${fmt(curPrice)} ₽</b></div>
            <div>Дата покупки: <b>${fmtISOtoRU(it.date)}</b></div>
            <div>Стоимость: <b>${fmt(curVal)} ₽</b></div>
            <div class="pnl-big" style="${pnlColor}">P/L: <b>${fmt(pnlAbs)} ₽</b> (${fmt(pnlPct)}%)</div>
          </div>
          <div class="chart-container" id="box-${id}">
            <div class="chart-tabs">
              <div class="chart-tab active" data-action="period" data-period="1D" data-for="${id}">День</div>
              <div class="chart-tab" data-action="period" data-period="1W" data-for="${id}">Неделя</div>
              <div class="chart-tab" data-action="period" data-period="1M" data-for="${id}">Месяц</div>
              <div class="chart-tab" data-action="period" data-period="1Y" data-for="${id}">Год</div>
            </div>
            <canvas id="canvas-${id}"></canvas>
          </div>
        </div>`;
      }).join('')
      : `<div class="asset-card" style="text-align:center;color:var(--muted)">Нет совпадений по запросу «${escHtml(searchQuery)}»</div>`;

      const totalVal = (allItems||[]).reduce((s,i)=>s+((i.currentPrice??i.avgPrice??0)*(i.quantity||0)),0);
      const matchBadge = query ? `<span class="meta-badge">Совпадений: ${items.length}/${allItems.length}</span>` : '';
      const hint = topInsideHint(allItems);

      wrap.insertAdjacentHTML('beforeend', `
        <section class="section ${open?'open':''}" data-section="${cat}">
          <div class="section-header" title="${escHtml(hint)}">
            <button class="section-toggle" data-action="toggle-section" data-section="${cat}" aria-expanded="${open}">
              <span class="chev">▸</span> ${label}
            </button>
            <div class="section-meta">
              <span>${fmt(totalVal)} ₽</span>
              ${matchBadge}
            </div>
          </div>
          <div class="section-body">
            <div class="assets-list">${listHTML}</div>
          </div>
        </section>`);
    }

    updateToggleAllBtn();
  }

  // ====== CHARTS ======
  function grad(ctx, c1, c2){ const g = ctx.createLinearGradient(0,0,0,220); g.addColorStop(0,c1); g.addColorStop(1,c2); return g; }
  function rebuild(id, cfg){ const el=document.getElementById(id); if(!el) return null; if(charts[id]) charts[id].destroy(); const ctx=el.getContext('2d'); charts[id]=new Chart(ctx,cfg); return charts[id]; }
  function removeSkeleton(){ ['sk1','sk2','sk3'].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.remove('skeleton'); }); }

  const donutCenter = (getTextFn) => ({
    id: 'donutCenter',
    beforeDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) return;
      const arc = meta.data[0];
      const { x, y } = arc;
      const innerR = arc.innerRadius;
      const outerR = arc.outerRadius;
      const ctx = chart.ctx;
      const info = getTextFn(chart);

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, (innerR + outerR) / 2 * 0.70, 0, Math.PI * 2);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card') || '#fff';
      ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#666';
      ctx.font = '700 12px Inter';
      if (info.title) ctx.fillText(info.title, x, y - 18);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text') || '#111';
      ctx.font = '800 16px Inter';
      if (info.line1) ctx.fillText(info.line1, x, y + 2);
      if (info.line2) {
        ctx.fillStyle = info.line2Color || (getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#666');
        ctx.font = '800 12px Inter';
        ctx.fillText(info.line2, x, y + 20);
      }
      ctx.restore();
    }
  });

  function renderCharts(){
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const isDark = theme === 'dark';
    const axisGrid = isDark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)';

    // Doughnut
    const classValues = [
      (portfolio.savings||[]).reduce((s,i)=>s+i.value,0),
      (portfolio.stocks||[]).reduce((s,i)=>s+((i.currentPrice??i.avgPrice??0)*(i.quantity||0)),0),
      (portfolio.bonds||[]).reduce((s,i)=>s+((i.currentPrice??i.avgPrice??0)*(i.quantity||0)),0),
      (portfolio.funds||[]).reduce((s,i)=>s+((i.currentPrice??i.avgPrice??0)*(i.quantity||0)),0)
    ];
    const total = classValues.reduce((a,b)=>a+b,0);
    const classLabels = ['Накопит','Акции','ОФЗ','Фонды'];
    const pl = totalPL();

    const el1 = document.getElementById('chartByClass');
    if (el1) {
      const ctx1 = el1.getContext('2d');
      if (charts.c1) charts.c1.destroy();
      const bg = [
        grad(ctx1,'rgba(67,97,238,.9)','rgba(67,97,238,.3)'),
        grad(ctx1,'rgba(127,240,249,.9)','rgba(127,240,249,.35)'),
        grad(ctx1,'rgba(247,37,133,.9)','rgba(247,37,133,.35)'),
        grad(ctx1,'rgba(6,214,160,.9)','rgba(6,214,160,.35)')
      ];
      charts.c1 = new Chart(ctx1, {
        type: 'doughnut',
        data: { labels: classLabels, datasets: [{ data: classValues, borderWidth: 0, hoverOffset: 8, cutout: '62%', backgroundColor: bg }] },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => {
              const val = c.raw || 0; const p = total > 0 ? (val / total * 100) : 0;
              return `${c.label}: ${fmt(val)} ₽ (${fmt(p)}%)`;
            }}},
            title:{ display:false }
          },
          onHover: (_, els) => { charts.c1.setActiveElements(els); charts.c1.update(); },
          animation: { duration: 900, easing: 'easeOutQuart' }
        },
        plugins: [donutCenter((chart) => {
          const active = chart.getActiveElements?.() || [];
          if (active.length) {
            const i = active[0].index; const val = classValues[i];
            const p = total > 0 ? (val / total * 100) : 0;
            return { title: classLabels[i], line1: `${fmt(val)} ₽`, line2: `${fmt(p)}%` };
          } else {
            const color = pl.abs >= 0
              ? getComputedStyle(document.documentElement).getPropertyValue('--ok')
              : getComputedStyle(document.documentElement).getPropertyValue('--accent');
            return { title:'Всего', line1:`${fmt(total)} ₽`, line2:`P/L: ${fmt(pl.abs)} ₽ (${fmt(pl.pct)}%)`, line2Color: color };
          }
        })]
      });
      el1.addEventListener('mouseleave', () => { charts.c1.setActiveElements([]); charts.c1.update(); });
    }

    // Bars
    const items = [...(portfolio.stocks||[]), ...(portfolio.bonds||[]), ...(portfolio.funds||[])]
      .filter(i => (i.quantity||0)>0);
    const labelsTickers = items.map(i=> displayLabel(i) || i.name);
    const values = items.map(i=>(i.currentPrice??i.avgPrice??0)*(i.quantity||0));
    const qtys   = items.map(i=>i.quantity||0);

    const trimLabel = s => (s||'').length>18 ? (s||'').slice(0,17)+'…' : (s||'');

    const barOpts = {
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:(c)=> `${fmt(c.raw)} ${c.dataset.unit || ''}` } } },
      scales:{
        x:{ grid:{ display:false }, ticks:{ maxRotation: 45, minRotation: 0, autoSkip:true, callback:(v, i)=> trimLabel(labelsTickers[i]) } },
        y:{ ticks:{ callback:(v)=> fmt(v) }, grid:{ color:axisGrid } }
      },
      animation:{duration:700}
    };

    if(document.getElementById('chartByTickerValue')) rebuild('chartByTickerValue', {
      type:'bar',
      data:{ labels: labelsTickers, datasets:[{ data:values, borderRadius:10, unit:'₽', backgroundColor:(c)=>{const ctx=c.chart.ctx;return grad(ctx,'rgba(67,97,238,.9)','rgba(127,240,249,.4)')} }] },
      options: barOpts
    });

    if(document.getElementById('chartByTickerQty')) rebuild('chartByTickerQty', {
      type:'bar',
      data:{ labels: labelsTickers, datasets:[{ data:qtys, borderRadius:10, unit:'шт.', backgroundColor:(c)=>{const ctx=c.chart.ctx;return grad(ctx,'rgba(6,214,160,.9)','rgba(67,97,238,.4)')} }] },
      options:{
        ...barOpts,
        scales:{
          x:{ grid:{ display:false }, ticks:{ maxRotation: 45, minRotation: 0, autoSkip:true, callback:(v, i)=> trimLabel(labelsTickers[i]) } },
          y:{ ticks:{ callback:(v)=> fmt(v,0) }, grid:{ color:axisGrid } }
        }
      }
    });

    removeSkeleton();
  }

  function makeLineChart(canvasId,label){
    const el = document.getElementById(canvasId); if(!el) return null;
    const ctx = el.getContext('2d');
    const g = ctx.createLinearGradient(0,0,0,300);
    g.addColorStop(0,'rgba(67,97,238,.35)'); g.addColorStop(1,'rgba(67,97,238,.02)');
    charts[canvasId] = new Chart(ctx,{
      type:'line',
      data:{ labels:[], datasets:[{ label, data:[], borderWidth:2.5, fill:true, backgroundColor:g, borderColor:getComputedStyle(document.documentElement).getPropertyValue('--brand')||'#4361ee', pointRadius:0, tension:.25 }] },
      options:{
        responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false }, tooltip:{ mode:'index', intersect:false, callbacks:{ label:(c)=> `${fmt(c.parsed.y)} ₽` } } },
        scales:{
          x:{ grid:{ display:false }, ticks:{ maxRotation:0, autoSkip:true } },
          y:{ grid:{ color:getComputedStyle(document.documentElement).getPropertyValue('--stroke')||'rgba(0,0,0,.1)' }, ticks:{ callback:(v)=> fmt(v) } }
        },
        animation:{duration:600},
        interaction:{ intersect:false, mode:'nearest' }
      }
    });
    return charts[canvasId];
  }

  function periodToBackend(period){
    const to = new Date();
    const from = new Date(to);
    let interval = '1d';
    if(period==='1D'){ interval='1min'; from.setDate(to.getDate()-1); }
    else if(period==='1W'){ interval='15min'; from.setDate(to.getDate()-7); }
    else if(period==='1M'){ interval='1h'; from.setDate(to.getDate()-30); }
    else if(period==='1Y'){ interval='1d'; from.setFullYear(to.getFullYear()-1); }
    return { interval, fromISO: from.toISOString(), toISO: to.toISOString() };
  }
  function formatXAxisLabel(period, isoString){
    const d = new Date(isoString);
    if(period==='1D'){ const hh = d.getHours().toString().padStart(2,'0'); const mm = d.getMinutes().toString().padStart(2,'0'); return `${hh}:${mm}`; }
    if(period==='1W' || period==='1M'){ const dd = d.getDate().toString().padStart(2,'0'); const mm = (d.getMonth()+1).toString().padStart(2,'0'); return `${dd}.${mm}`; }
    const mm = (d.getMonth()+1).toString().padStart(2,'0'); const yy = (d.getFullYear()%100).toString().padStart(2,'0'); return `${mm}.${yy}`;
  }
  async function updateAssetChartByFigi(canvasId, figi, label, period){
    let {interval, fromISO, toISO} = periodToBackend(period);
    let data = await apiCandles(figi, interval, fromISO, toISO);
    if ((!data || data.length === 0) && (interval === '1min' || interval === '5min' || interval === '15min')) {
      const fallback = interval === '15min' ? '1h' : (interval === '5min' ? '15min' : '5min');
      data = await apiCandles(figi, fallback, fromISO, toISO);
    }
    const ch = charts[canvasId] || makeLineChart(canvasId, label);
    ch.data.labels = (data||[]).map(x=> formatXAxisLabel(period, x.time));
    ch.data.datasets[0].data = (data||[]).map(x=> x.close);
    ch.update();
  }

  // ====== QUOTES ======
  async function recalcQuotes(){
    if(isRefreshing) return; isRefreshing = true;
    const tickers = [
      ...(portfolio.stocks||[]).map(i=>i.name),
      ...(portfolio.bonds||[]).map(i=>i.name),
      ...(portfolio.funds||[]).map(i=>i.name),
    ];
    if(!tickers.length){ isRefreshing=false; return; }
    try{
      const results = await apiBatchQuotes(tickers);
      const map = {}; results.forEach(q => { map[(q.ticker||'').toUpperCase()] = q; });
      for(const cat of ['stocks','bonds','funds']){
        for(const it of (portfolio[cat]||[])){
          const q = map[(it.name||'').toUpperCase()]; if(!q) continue;
          it.figi = q.figi;
          it.currency = q.currency;
          it.ticker = q.ticker;
          it.displayName = (q.name && q.ticker) ? `${q.name} (${q.ticker})` : (q.name || q.ticker || it.name);
          it.currentPrice = q.price;
          it.value = (it.currentPrice??it.avgPrice??0) * (it.quantity||0);
          it.pnlAbs = it.avgPrice ? (it.currentPrice - it.avgPrice) * (it.quantity||0) : 0;
          it.pnlPct = it.avgPrice ? ((it.currentPrice - it.avgPrice)/it.avgPrice*100) : 0;
        }
      }
      pushHistory();
      if(!isAnyChartOpen){ renderSummary(); renderSections(); renderCharts(); }
      saveLocal();
    }catch(err){
      console.error(err);
      toast('Ошибка обновления котировок','err');
    }finally{
      isRefreshing = false;
    }
  }

  // ====== ADD / EDIT / DELETE ======
  function ensureAuthGuard(){ if(!auth.token || !auth.userId){ toast('Войдите в аккаунт, чтобы сохранять в БД','err'); window.location.href='login.html'; return false; } return true; }

  async function addAsset(e){
    e.preventDefault();
    const type = document.getElementById('assetType').value;
    let dateVal = document.getElementById('assetDate').value || '';
    if(dateVal && dateVal.indexOf('-')<0){
      const iso = toISOFromAlt(dateVal);
      if(iso) dateVal = iso;
    }
    const date = dateVal || new Date().toISOString().slice(0,10);

    if(type==='savings'){
      const amount = parseFloat(document.getElementById('savingsAmount').value)||0;
      if(amount<=0){ toast('Введите сумму для накопительного счёта','err'); return; }
      portfolio.savings.push({ value: amount, date });
      toast('Пополнение сохранено (локально)');
    } else {
      if(!ensureAuthGuard()) return;

      const name = (document.getElementById('assetName').value||'').trim().toUpperCase();
      const qty  = parseFloat(document.getElementById('assetQuantity').value)||0;
      const avg  = parseFloat(document.getElementById('assetAvgPrice').value)||0;
      if(!name || qty<=0){ toast('Введите тикер и количество','err'); return; }

      const mapClass = { stock:'share', bond:'bond', fund:'etf' };
      const classHint = mapClass[type] || null;

      try{
        const r = await apiResolve(name, classHint);
        const pfId = auth.portfolioId || (await apiCreatePortfolio()).id;

        await apiUpsertPositionByFigi({
          portfolio_id: pfId, figi: r.figi, ticker: name, class_hint: classHint,
          qty: qty, avg: avg, name: r.name, currency: r.currency, nominal: r.nominal || null
        });

        // Без локального push — перечитываем портфель, тогда позиция уже будет агрегирована
        toast('Сделка сохранена');
        await loadFromDB();
        await recalcQuotes();
      }catch(err){
        console.error(err);
        toast(err?.response?.data?.detail || err?.message || 'Ошибка добавления', 'err');
        return;
      }
    }

    renderSummary(); renderSections(); renderCharts();
    pushHistory(); saveLocal();
    e.target.reset(); if(fp) fp.setDate(new Date()); onTypeChange();

    const btn = document.getElementById('addBtn');
    btn.classList.remove('rippling'); setTimeout(()=> btn.classList.add('rippling'), 0); setTimeout(()=> btn.classList.remove('rippling'), 250);
  }

  document.addEventListener('click', async (e)=>{
    const act = e.target.closest('[data-action]'); if(!act) return;
    const action = act.getAttribute('data-action');

    if(action==='del'){
      const type = act.getAttribute('data-type');
      const idx = Number(act.getAttribute('data-index'));
      const it = (portfolio[type]||[])[idx];
      if(!it) return;

      if(it.posId){
        try { await apiDeletePosition(it.posId); }
        catch(err){ console.warn('delete failed', err); toast('Ошибка удаления в БД','err'); return; }
      }

      (portfolio[type]||[]).splice(idx,1);
      renderSummary(); renderSections(); renderCharts(); saveLocal();
      toast('Удалено'); return;
    }

    if(action==='edit'){
      const type = act.getAttribute('data-type');
      const idx = Number(act.getAttribute('data-index'));
      const it = (portfolio[type]||[])[idx]; if(!it) return;

      // ДЕЛЬТА по количеству: покупка +N, продажа -N
      const dqStr = prompt(
        `Сделка для ${displayLabel(it)}:\nУкажи Δкол-во (покупка = +, продажа = -).\nСейчас: ${fmt(it.quantity,0)} шт.`,
        '1'
      );
      if (dqStr === null) return;
      const dq = parseFloat(dqStr) || 0;
      if (dq === 0){ toast('Ничего не изменилось'); return; }

      const priceStr = prompt('Цена сделки за 1 шт. (₽):', it.currentPrice ?? it.avgPrice ?? 0);
      if (priceStr === null) return;
      const price = parseFloat(priceStr) || 0;
      if (price <= 0){ toast('Нужна цена сделки','err'); return; }

      const curQty = it.quantity || 0;
      const curAvg = it.avgPrice || 0;
      const newQty = curQty + dq;
      if (newQty < 0){ toast('Нельзя продать больше, чем есть','err'); return; }

      let newAvg = curAvg;
      if (dq > 0) {
        newAvg = ((curAvg * curQty) + (price * dq)) / (curQty + dq);
      } else if (dq < 0) {
        if (newQty === 0) newAvg = 0;
      }

      try{
        await apiUpsertPositionByFigi({
          portfolio_id: auth.portfolioId,
          figi: it.figi,
          ticker: it.ticker || it.name,
          class_hint: it.class || null,
          qty: dq,
          avg: price,
          name: it.displayName,
          currency: it.currency,
          nominal: it.nominal
        });

        it.quantity = newQty;
        it.avgPrice = newAvg;
        await loadFromDB();      // чтобы точно синхронизироваться с БД
        await recalcQuotes();
        toast('Сделка записана');
      }catch(err){
        console.warn('upsert failed', err);
        toast('Ошибка сохранения в БД','err');
      }
      return;
    }

    if(action==='show'){
      const name = act.getAttribute('data-name');
      const id = cssId(name);
      const box = document.getElementById(`box-${id}`);
      if(!box) return;

      const isOpen = box.classList.contains('open');
      document.querySelectorAll('.chart-container').forEach(el=> el.classList.remove('open'));
      if(isOpen){ isAnyChartOpen = false; return; }
      box.classList.add('open'); isAnyChartOpen = true;

      const it = [...(portfolio.stocks||[]), ...(portfolio.bonds||[]), ...(portfolio.funds||[])]
        .find(x => x.name === name);
      const figi = it?.figi;
      const canvasId = `canvas-${id}`;
      const el = document.getElementById(canvasId);

      if(charts[canvasId] && charts[canvasId].canvas !== el){ try{ charts[canvasId].destroy(); }catch(_){ } delete charts[canvasId]; }
      if(!charts[canvasId]){ makeLineChart(canvasId, displayLabel(it) || it?.name || name); }

      if(figi){ await updateAssetChartByFigi(canvasId, figi, displayLabel(it) || it?.name || name, '1D'); }
      else{ toast('Нет FIGI для графика — обнови котировки','err'); }

      box.querySelectorAll('.chart-tab').forEach(t=> t.classList.remove('active'));
      box.querySelector('[data-period="1D"]').classList.add('active');
      setTimeout(()=>{ box.scrollIntoView({behavior:'smooth', block:'nearest'}); }, 50);
      return;
    }

    if(action==='period'){
      const id = act.getAttribute('data-for');
      const box = document.getElementById(`box-${id}`); if(!box) return;
      box.querySelectorAll('.chart-tab').forEach(t=> t.classList.remove('active'));
      act.classList.add('active');
      const period = act.getAttribute('data-period');
      const card = act.closest('.asset-card');
      const name = card?.querySelector('[data-action="show"]')?.getAttribute('data-name');
      const it = [...(portfolio.stocks||[]), ...(portfolio.bonds||[]), ...(portfolio.funds||[])]
        .find(x => x.name === name);
      if(it?.figi){ await updateAssetChartByFigi(`canvas-${id}`, it.figi, displayLabel(it) || it?.name || name, period); }
      else{ toast('Нет FIGI для графика — обнови котировки','err'); }
      return;
    }

    if(action==='toggle-section'){
      const sec = act.getAttribute('data-section');
      collapsedMap[sec] = !collapsedMap[sec];
      saveCollapsed();
      const el = document.querySelector(`.section[data-section="${sec}"]`);
      if(el){ el.classList.toggle('open', !collapsedMap[sec]); const btn = el.querySelector('.section-toggle'); if(btn) btn.setAttribute('aria-expanded', String(!collapsedMap[sec])); }
      updateToggleAllBtn();
      return;
    }
  });

  function onTypeChange(){
    const t = document.getElementById('assetType').value;
    const isSavings = t==='savings';
    document.getElementById('fieldName').style.display = isSavings ? 'none' : '';
    document.getElementById('fieldQuantity').style.display = isSavings ? 'none' : '';
    document.getElementById('fieldPrice').style.display = isSavings ? 'none' : '';
    document.getElementById('fieldSavingsAmount').style.display = isSavings ? '' : 'none';
    document.getElementById('assetName').required = !isSavings;
    document.getElementById('assetQuantity').required = !isSavings;
    document.getElementById('assetAvgPrice').required = false;
    document.getElementById('savingsAmount').required = isSavings;
  }

  function updateToggleAllBtn(){
    const btn = document.getElementById('toggleAllBtn');
    if(!btn) return;
    const q = (searchQuery||'').trim();
    btn.disabled = !!q;
    const anyOpen = document.querySelectorAll('.section.open').length > 0;
    if(anyOpen){
      btn.textContent = '⤵️ Все';
      btn.title = q ? 'Недоступно во время поиска' : 'Свернуть все секции';
      btn.setAttribute('aria-label','Свернуть все секции');
    }else{
      btn.textContent = '⤴️ Все';
      btn.title = q ? 'Недоступно во время поиска' : 'Развернуть все секции';
      btn.setAttribute('aria-label','Развернуть все секции');
    }
  }

  function hookHeaderButtons(){
    const toggle = document.getElementById('toggleAllBtn');
    toggle.addEventListener('click', ()=>{
      toggle.style.setProperty('--rx', '50%'); toggle.style.setProperty('--ry', '50%');
      toggle.classList.remove('rippling'); setTimeout(()=> toggle.classList.add('rippling'), 0); setTimeout(()=> toggle.classList.remove('rippling'), 250);

      const anyOpen = document.querySelectorAll('.section.open').length > 0;
      const keys = ['stocks','bonds','funds','savings'];
      if(anyOpen){
        keys.forEach(k=> collapsedMap[k]=true);
        document.querySelectorAll('.section').forEach(s=> s.classList.remove('open'));
      }else{
        keys.forEach(k=> collapsedMap[k]=false);
        document.querySelectorAll('.section').forEach(s=> s.classList.add('open'));
      }
      saveCollapsed();
      updateToggleAllBtn();
    });

    const si = document.getElementById('searchInput');
    si.addEventListener('input', ()=>{
      searchQuery = si.value || '';
      saveSearch();
      renderSections();
    });
  }

  // ====== INIT ======
  const io = new IntersectionObserver((ents)=>{
    ents.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('animate-in'); io.unobserve(e.target); } });
  }, {threshold:.12});

  async function hardRefresh(){ await recalcQuotes(); }

  document.addEventListener('DOMContentLoaded', async ()=>{
    initTheme();

    /* компактный хедер при скролле */
    const headerEl = document.querySelector('header');
    const applyCompact = () => headerEl.classList.toggle('header--compact', window.scrollY > 8);
    window.addEventListener('scroll', applyCompact, { passive: true });
    applyCompact();

    document.getElementById('themeToggle').addEventListener('click', (e)=>{
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left)/rect.width*100).toFixed(2)+"%";
      const y = ((e.clientY - rect.top)/rect.height*100).toFixed(2)+"%";
      e.currentTarget.style.setProperty('--rx', x); e.currentTarget.style.setProperty('--ry', y);
      e.currentTarget.classList.remove('rippling'); setTimeout(()=> e.currentTarget.classList.add('rippling'), 0); setTimeout(()=> e.currentTarget.classList.remove('rippling'), 250);
      const cur = document.documentElement.getAttribute('data-theme')==='dark' ? 'light' : 'dark'; setTheme(cur);
    });

    initDatePicker();
    loadTitle();
    document.getElementById('editTitleBtn').addEventListener('click', ()=>{
      const cur = document.getElementById('portfolioTitle').textContent.trim();
      const v = prompt('Введите новое название портфеля', cur);
      if(v!==null && v.trim()){
        localStorage.setItem('pf_title', v.trim());
        applyTitle(v.trim());
        toast('Название обновлено');
      }
    });

    loadAuth();
    loadLocal();
    loadCollapsed();
    loadSearch();
    hookHeaderButtons();
    hookTokenModal();         // <<-- НОВОЕ
    await refreshApiIndicator(); // <<-- НОВОЕ

    document.getElementById('logoutBtn').addEventListener('click', ()=>{
      clearAuth(); toast('Вы вышли'); window.location.href='login.html';
    });

    document.getElementById('assetForm').addEventListener('submit', addAsset);
    document.getElementById('assetType').addEventListener('change', onTypeChange);
    onTypeChange();

    try{ await loadFromDB(); }catch(e){ console.warn('loadFromDB failed', e); toast('Не удалось загрузить портфель из БД','err'); }

    renderSummary(); renderSections(); renderCharts();
    document.querySelectorAll('.chart-card, .summary-card, .section').forEach(el=> io.observe(el));

    document.getElementById('refreshBtn').addEventListener('click', hardRefresh);
    await hardRefresh();
    if(quotesTimer) clearInterval(quotesTimer);
    quotesTimer = setInterval(async ()=>{
      await hardRefresh();
      await refreshApiIndicator(); // индикатор не «зависает»
    }, 30 * 1000);
  });