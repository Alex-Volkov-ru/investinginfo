(() => {
  'use strict';

  /* ---------------- utils ---------------- */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const nf = new Intl.NumberFormat('ru-RU');
  const money = n => nf.format(Math.round(Number(n)||0));
  const escH  = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const escA  = s => String(s).replace(/"/g,'&quot;');
  const todayISO = () => new Date().toISOString().slice(0,10);
  const cssVar   = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || name;
  const clone    = obj => JSON.parse(JSON.stringify(obj));

  const toNum = (v, def=0) => {
    if (v === null || v === undefined || v === '') return def;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : def;
  };
  const toInt = (v, def=0) => {
    if (v === null || v === undefined || v === '') return def;
    const n = parseInt(String(v).replace(',', '.'), 10);
    return Number.isFinite(n) ? n : def;
  };

  const isIsoDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
  const isRuDate  = s => typeof s === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(s.trim());
  function toIsoOrNull(v){
    if (v == null || v === '') return null;
    const s = String(v).trim();
    if (isIsoDate(s)) return s;
    if (isRuDate(s)) {
      const [dd,mm,yyyy] = s.split('.');
      return `${yyyy}-${mm}-${dd}`;
    }
    const d = new Date(s);
    if (!isNaN(d)) {
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const day = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    }
    return null;
  }

  /* ---------------- toast ---------------- */
  function toast(msg, type='ok', ms=2600){
    let wrap = $('#toastWrap'); if(!wrap) return;
    const t = document.createElement('div');
    t.className = 'ob-toast';
    t.textContent = msg;
    if (type==='err') t.style.borderLeftColor = '#ff6b7a';
    wrap.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(6px)'; setTimeout(()=>t.remove(), 380); }, ms);
  }

  /* ---------------- API ---------------- */
  const token = localStorage.getItem('pf_token');
  if (!token) { window.location.href = 'login.html'; return; }

  const isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
  const API_BASE = isLocal ? 'http://127.0.0.1:8000' : '/api';

  const api = axios.create({ baseURL: API_BASE, timeout: 20000 });
  api.interceptors.request.use(cfg => {
    cfg.headers = cfg.headers || {};
    cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
  });

  // -------- map API <-> UI (берём и computed с бэка) --------
  const fromApi = (row) => ({
    id: row.id,
    startDate: row.start_date || '',
    title: row.title || 'Обязательство',
    total: toNum(row.total),
    monthly: toNum(row.monthly),
    rate: toNum(row.rate),
    dueDay: toInt(row.due_day, 15),
    nextPayment: row.next_payment || '',
    closeDate: row.close_date || '',
    status: row.status || 'Активный',
    notes: row.notes || '',
    payments: (row.payments||[]).map(p => ({
      id: p.id, n: toInt(p.n), ok: !!p.ok, date: p.date || '', amount: toNum(p.amount), note: p.note || ''
    })),
    paid_total: toNum(row.paid_total),
    paid_interest: toNum(row.paid_interest),
    paid_principal: toNum(row.paid_principal),
    remaining: toNum(row.remaining),
    progress_pct: toNum(row.progress_pct),
  });

  const toApi = (item) => {
    const payments = (item.payments || []).map((p, i) => ({
      id: p.id ?? null,
      n: i + 1,
      ok: !!p.ok,
      date: toIsoOrNull(p.date),
      amount: toNum(p.amount),
      note: p.note || ''
    }));
    return {
      id: item.id,
      title: (item.title || '').trim() || 'Обязательство',
      total:   toNum(item.total),
      monthly: toNum(item.monthly),
      rate:    toNum(item.rate),
      due_day: Math.min(31, Math.max(1, toInt(item.dueDay, 15))),
      start_date:  toIsoOrNull(item.startDate),
      next_payment: toIsoOrNull(item.nextPayment),
      close_date:   toIsoOrNull(item.closeDate),
      status: item.status || 'Активный',
      notes:  item.notes  || '',
      payments,
    };
  };

  async function apiList(){ const {data}=await api.get('/budget/obligation-blocks'); return data.map(fromApi); }
  async function apiCreate(title){
    const {data}=await api.post('/budget/obligation-blocks', { title: (title||'').trim() || 'Обязательство' });
    return fromApi(data);
  }
  async function apiUpdate(item){
    const payload = toApi(item);
    const {data}=await api.put(`/budget/obligation-blocks/${item.id}`, payload);
    return fromApi(data);
  }
  async function apiDelete(id){ await api.delete(`/budget/obligation-blocks/${id}`); }

  /* ---------- preview для точного пересчёта (ACT/365F) ---------- */
  const debounce = (fn, ms=250) => { let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

  async function previewOnServer(item) {
    const payload = toApi(item);
    const { data } = await api.post('/budget/obligation-blocks/preview', payload);
    return data; // BlockDTO с метриками
  }

  const updateComputed = debounce(async (root, item) => {
    try {
      const dto = await previewOnServer(item);
      item.paid_total     = dto.paid_total;
      item.paid_interest  = dto.paid_interest;
      item.paid_principal = dto.paid_principal;
      item.remaining      = dto.remaining;
      item.progress_pct   = dto.progress_pct;

      root.querySelector('[data-bind="remain"]').textContent    = money(item.remaining || 0);
      root.querySelector('[data-bind="principal"]').textContent = money(item.paid_principal || 0);
      root.querySelector('[data-bind="paid"]').textContent      = money(item.paid_total || 0);
      drawChart(root.querySelector('canvas'), item.paid_principal || 0, (+item.total||0), item.progress_pct || 0);
    } catch (e) {
      console.error('preview failed', e);
      // если превью недоступно — не рушим UI
    }
  }, 250);

  /* ---------------- UI ---------------- */
  const el = {
    section: $('#obSection'),
    list:    $('#obList'),
    empty:   $('#obEmpty'),
    search:  $('#searchInput'),
    addBtn:  $('#addObBtn'),
    m: $('#createObModal'), mInput: $('#createNameInput'),
    mOk: $('#createCreateBtn'), mCancel: $('#createCancelBtn'), mCloseX: $('#createCloseX'),
    r: $('#renameObModal'), rInput: $('#renameNameInput'),
    rOk: $('#renameOkBtn'), rCancel: $('#renameCancelBtn'), rCloseX: $('#renameCloseX'),
    c: $('#confirmObModal'), cText: $('#confirmText'),
    cOk: $('#confirmOkBtn'), cCancel: $('#confirmCancelBtn'), cCloseX: $('#confirmCloseX'),
  };
  if (!el.list || !el.addBtn) return;

  const openModal = box => { if(!box) return; box.style.display='flex'; document.body.style.overflow='hidden'; };
  const closeModal = box => { if(!box) return; box.style.display='';     document.body.style.overflow=''; };

  let items = [];
  let currentRenamingItem = null;

  async function loadAndRender(){
    try { 
      items = await apiList(); 
      render(); 
      updateTotals(); // Обновляем плашки после загрузки данных
    }
    catch (err){ console.error(err); toast(err?.response?.data?.detail || 'Ошибка загрузки', 'err', 3600); }
  }

  /* --------- ВЕРХНЯЯ ПАНЕЛЬ --------- */
  function bindTopbar() {
    const refreshBtn = $('#refreshBtn') || $('[data-action="refresh"]');
    const themeBtn   = $('#themeToggle')   || $('[data-action="theme"]');
    const logoutBtn  = $('#logoutBtn')  || $('[data-action="logout"]');
    const helpBtn    = $('#helpBtn')    || $('[data-action="help"]');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await loadAndRender(); // мягкое обновление списка
        toast('Обновлено');
      });
    }

    if (themeBtn) {
      const applyTheme = (mode) => {
        document.documentElement.dataset.theme = mode; // [data-theme="dark|light"] для CSS
        localStorage.setItem('pf_theme', mode);
      };
      // init
      const saved = localStorage.getItem('pf_theme') || 'dark';
      applyTheme(saved);

      themeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const curr = document.documentElement.dataset.theme || 'dark';
        applyTheme(curr === 'dark' ? 'light' : 'dark');
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!confirm('Выйти из аккаунта?')) return;
        localStorage.removeItem('pf_token');
        window.location.href = 'login.html';
      });
    }

    if (helpBtn) {
      helpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const helpModal = $('#helpModal');
        if (helpModal) {
          openModal(helpModal);
        }
      });
    }
  }

  /* --------- СВЕРНУТЬ/РАЗВЕРНУТЬ РАЗДЕЛ «МОИ ОБЯЗАТЕЛЬСТВА» --------- */
  function bindSectionToggle() {
    if (!el.section) return;

    // Пытаемся найти стрелку/тогглер разными селекторами
    const tog =
      $('#obSection [data-act="section-toggle"]') ||
      $('#obSection .section-toggle') ||
      $('#obSection .ob-section__toggle') ||
      $('#obSection .chev') ||
      $('#obSection .toggle') ||
      null;

    const body =
      $('#obListWrap') ||
      $('#obList') ||
      $('#obSection .ob-section__body') ||
      null;

    const applyState = (open) => {
      el.section.classList.toggle('open', open);
      el.section.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (tog) tog.classList.toggle('rotated', open);
      if (body) body.style.display = open ? '' : 'none';
    };

    // инициализация: по умолчанию открыто
    applyState(true);

    if (tog) {
      tog.addEventListener('click', (e) => {
        e.preventDefault();
        const open = !(el.section.classList.contains('open'));
        applyState(open);
      });
    }

    // Клик по заголовку секции тоже может разворачивать
    const header = $('#obSection .ob-section__head') || $('#obSection .ob-header');
    if (header && !tog) {
      header.addEventListener('click', (e) => {
        if (e.target.closest('button, a, input, select, textarea')) return;
        const open = !(el.section.classList.contains('open'));
        applyState(open);
      });
    }
  }

  el.addBtn.addEventListener('click', ()=>{ if(el.mInput) el.mInput.value=''; openModal(el.m); setTimeout(()=>el.mInput?.focus(),30); });
  el.mCancel?.addEventListener('click', ()=>closeModal(el.m));
  el.mCloseX?.addEventListener('click', ()=>closeModal(el.m));
  el.m?.addEventListener('click', e=>{ if(e.target===el.m) closeModal(el.m); });
  
  // Help modal handlers
  $('#helpCloseBtn')?.addEventListener('click', ()=>closeModal($('#helpModal')));
  $('#helpCloseX')?.addEventListener('click', ()=>closeModal($('#helpModal')));
  $('#helpModal')?.addEventListener('click', e=>{ if(e.target.id==='helpModal') closeModal($('#helpModal')); });
  
  // Rename modal handlers
  $('#renameCancelBtn')?.addEventListener('click', ()=>{
    closeModal($('#renameObModal'));
    currentRenamingItem = null;
  });
  $('#renameCloseX')?.addEventListener('click', ()=>{
    closeModal($('#renameObModal'));
    currentRenamingItem = null;
  });
  $('#renameObModal')?.addEventListener('click', e=>{ 
    if(e.target.id==='renameObModal') {
      closeModal($('#renameObModal'));
      currentRenamingItem = null;
    }
  });
  // Функция сохранения переименования
  const saveRename = () => {
    const newName = $('#renameNameInput')?.value?.trim();
    if (newName && currentRenamingItem) {
      // Обновляем название в данных
      currentRenamingItem.title = newName;
      
      // Находим DOM элемент и обновляем отображение
      const activeCard = document.querySelector(`.ob-card[data-id="${currentRenamingItem.id}"]`);
      if (activeCard) {
        activeCard.querySelector('.ob-card__title').textContent = newName;
      }
      
      toast('Название изменено');
      closeModal($('#renameObModal'));
      currentRenamingItem = null; // Очищаем ссылку
    }
  };

  $('#renameOkBtn')?.addEventListener('click', saveRename);
  
  // Поддержка Enter в поле ввода
  $('#renameNameInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRename();
    }
  });
  
  el.mOk?.addEventListener('click', async ()=>{
    const name = (el.mInput?.value||'').trim();
    try{
      const created = await apiCreate(name);
      items.unshift(created);
      render();
      updateTotals(); // Обновляем плашки после создания
      closeModal(el.m); toast('Создано');
      el.section?.classList.add('open');
      if (el.search) el.search.value='';
    }catch(err){
      console.error(err); toast(err?.response?.data?.detail || 'Не удалось создать', 'err', 3600);
    }
  });

  function render(){
    el.list.innerHTML = '';
    const q=(el.search?.value||'').toLowerCase();
    const rows = items.filter(x=>!q || x.title.toLowerCase().includes(q) || (x.notes||'').toLowerCase().includes(q));
    if(el.empty) el.empty.style.display = rows.length ? 'none' : '';
    rows.forEach(it => el.list.appendChild(renderCard(it)));
    
    // Обновляем плашки с итогами
    updateTotals();
  }

  // Функция подсчета итогов
  function calculateTotals() {
    const totals = {
      all: 0,
      credits: 0,
      paid: 0,
      remaining: 0
    };

    items.forEach(item => {
      // Используем правильные поля из данных
      const totalAmount = parseFloat(item.total) || 0;
      const paidAmount = parseFloat(item.paid_total) || 0;
      const remainingAmount = parseFloat(item.remaining) || 0;

      // ВСЕГО - общая сумма всех обязательств
      totals.all += totalAmount;

      // Проверяем, является ли это кредитом (по названию)
      const isCredit = item.title.toLowerCase().includes('кредит') || 
                      item.title.toLowerCase().includes('займ') ||
                      item.title.toLowerCase().includes('ипотека') ||
                      item.title.toLowerCase().includes('автокредит');

      if (isCredit) {
        totals.credits += totalAmount;
      }

      // ОПЛАЧЕНО - сумма уже выплаченного
      totals.paid += paidAmount;

      // ОСТАЛОСЬ - оставшаяся сумма к выплате
      totals.remaining += remainingAmount;
    });

    return totals;
  }

  // Функция обновления плашек
  function updateTotals() {
    const totals = calculateTotals();
    
    // Форматирование чисел
    const formatAmount = (amount) => {
      return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount) + ' ₽';
    };

    // Обновляем значения в DOM
    const totalAllEl = document.getElementById('totalAll');
    const totalCreditsEl = document.getElementById('totalCredits');
    const totalPaidEl = document.getElementById('totalPaid');
    const totalRemainingEl = document.getElementById('totalRemaining');

    if (totalAllEl) totalAllEl.textContent = formatAmount(totals.all);
    if (totalCreditsEl) totalCreditsEl.textContent = formatAmount(totals.credits);
    if (totalPaidEl) totalPaidEl.textContent = formatAmount(totals.paid);
    if (totalRemainingEl) totalRemainingEl.textContent = formatAmount(totals.remaining);
  }

  // Обработчики событий
  el.search?.addEventListener('input', render);
  
  // Toggle all sections button
  $('#toggleAllBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    const section = $('#obSection');
    if (section) {
      const isOpen = section.classList.contains('open');
      section.classList.toggle('open', !isOpen);
      const btn = e.target;
      btn.textContent = isOpen ? '⤴️ Все' : '⤵️ Все';
      btn.title = isOpen ? 'Развернуть все секции' : 'Свернуть все секции';
    }
  });

  function renderCard(item){
    const root=document.createElement('div');
    root.className='ob-card';
    root.dataset.id=item.id;
    root.innerHTML=`
      <div class="ob-card__head">
        <div class="ob-card__left">
          <button class="ob-card__toggle" title="Свернуть/развернуть"><span class="chev">▸</span></button>
          <div class="ob-card__title">${escH(item.title)}</div>
        </div>
        <div class="ob-card__actions">
          <span class="ob-badge">${escH(item.status)}</span>
          <button class="btn" data-act="save">💾 Сохранить</button>
          <button class="btn btn-ghost" data-act="rename">✏️ Переименовать</button>
          <button class="btn btn-ghost" data-act="duplicate">🧬 Дублировать</button>
          <button class="btn btn-danger" data-act="remove">🗑 Удалить</button>
        </div>
      </div>

      <div class="ob-stats">
        <div class="ob-stat"><div class="ob-stat__label">Осталось (тело)</div><div class="ob-stat__val" data-bind="remain">${money(item.remaining)}</div></div>
        <div class="ob-stat"><div class="ob-stat__label">Оплачено тела</div><div class="ob-stat__val" data-bind="principal">${money(item.paid_principal)}</div></div>
        <div class="ob-stat"><div class="ob-stat__label">Оплачено всего</div><div class="ob-stat__val" data-bind="paid">${money(item.paid_total)}</div></div>
      </div>

      <div class="ob-body">
        <div class="ob-block">
          <table class="ob-kv"><tbody>
            ${kv('Сумма долга общая','total',item.total,'number','step="0.01"')}
            ${kv('Ежемесячный платёж','monthly',item.monthly,'number','step="0.01"')}
            ${kv('% по кредиту','rate',item.rate,'number','step="0.01"')}
            ${kv('Платёж не позднее — числа','dueDay',item.dueDay,'number','min="1" max="31"')}
            ${kv('Дата выдачи (начало начисления)','startDate',item.startDate,'date')}
            ${kv('Следующий платёж','nextPayment',item.nextPayment,'date')}
            ${kv('Дата закрытия','closeDate',item.closeDate,'date')}
            <tr><th>Статус</th><td><select class="input" data-key="status">
              ${['Активный','Просрочен','Закрыт'].map(s=>`<option ${s===item.status?'selected':''}>${s}</option>`).join('')}
            </select></td></tr>
            <tr><th>Заметки</th><td><input class="input" data-key="notes" value="${escA(item.notes||'')}" placeholder="Комментарий…"></td></tr>
          </tbody></table>
        </div>

        <div class="ob-block">
          <div class="ob-chart">
            <canvas width="260" height="260"></canvas>
            <div class="ob-tip" hidden></div>
          </div>
        </div>

        <div class="ob-block">
          <table class="ob-pay">
            <thead><tr>
              <th class="ob-col-done">✓</th>
              <th style="width:48px;">№</th>
              <th class="ob-col-date">Дата платежа</th>
              <th class="ob-col-sум">Сумма</th>
              <th>Заметки</th>
            </tr></thead>
            <tbody></tbody>
          </table>
          <div style="margin-top:8px"><button class="btn" data-act="addRow">➕ Добавить строку</button></div>
        </div>
      </div>
    `;

    root.querySelector('.ob-card__toggle').addEventListener('click',()=> root.classList.toggle('collapsed'));

    root.querySelector('[data-act="save"]').addEventListener('click', async ()=>{
      try{
        const id = Number(root.dataset.id);
        const local = items.find(x=>Number(x.id)===id);
        const saved = await apiUpdate(local);
        const idx = items.findIndex(x=>Number(x.id)===id);
        if (idx>=0) items[idx] = saved;
        render();
        toast('Сохранено');
      }catch(err){
        console.error(err); toast(err?.response?.data?.detail || 'Ошибка сохранения', 'err', 3600);
      }
    });

    root.querySelector('[data-act="rename"]').addEventListener('click', async ()=>{
      // Сохраняем ссылку на текущий элемент
      currentRenamingItem = item;
      // Заполняем поле ввода текущим названием
      const renameInput = $('#renameNameInput');
      if (renameInput) {
        renameInput.value = item.title;
        openModal($('#renameObModal'));
        setTimeout(() => renameInput.focus(), 30);
      }
    });

    root.querySelector('[data-act="duplicate"]').addEventListener('click', async ()=>{
      try{
        const created = await apiCreate(item.title + ' (копия)');
        const copy = clone(item);
        copy.id = created.id;
        copy.payments = (copy.payments||[]).map((p,i)=>({
          id: created.payments[i]?.id ?? null,
          n:i+1, ok:p.ok, date:p.date || '', amount: toNum(p.amount), note:p.note||''
        }));
        const saved = await apiUpdate(copy);
        items.unshift(saved);
        render();
        toast('Скопировано');
      }catch(err){
        console.error(err); toast(err?.response?.data?.detail || 'Не удалось дублировать', 'err', 3600);
      }
    });

    root.querySelector('[data-act="remove"]').addEventListener('click', async ()=>{
      if(!confirm('Удалить блок?')) return;
      try{
        await apiDelete(item.id);
        items = items.filter(x=>x.id!==item.id);
        render();
        toast('Удалено');
      }catch(err){
        console.error(err); toast(err?.response?.data?.detail || 'Не удалось удалить', 'err', 3600);
      }
    });

    root.querySelectorAll('[data-key]').forEach(inp=>{
      inp.addEventListener('input', e=>{
        const key=e.target.getAttribute('data-key');
        let val=e.target.value;
        if (['total','monthly','rate'].includes(key)) val = toNum(val);
        if (key==='dueDay') val = Math.min(31, Math.max(1, toInt(val,15)));
        item[key]=val;
        updateComputed(root,item); // серверный превью-пересчёт
      });
    });

    const tbody=root.querySelector('.ob-pay tbody');
    (item.payments||[]).forEach(p=>tbody.appendChild(renderRow(item,p)));
    root.querySelector('[data-act="addRow"]').addEventListener('click', ()=>{
      const p={ id:null, n:(item.payments?.length||0)+1, ok:false, date:'', amount:0, note:'' };
      item.payments = item.payments || [];
      item.payments.push(p);
      tbody.appendChild(renderRow(item,p));
      updateComputed(root,item);
    });

    attachChart(root, item);
    updateComputed(root, item); // первичный точный пересчёт через превью
    return root;
  }

  function kv(label,key,val,type='number',extra=''){
    const v = val ?? '';
    return `<tr><th>${label}</th><td><input class="input" data-key="${key}" type="${type}" ${extra} value="${type==='date'? v : escA(v)}"></td></tr>`;
  }

  function renderRow(item, p){
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="ob-col-done"><input type="checkbox" ${p.ok?'checked':''}></td>
      <td>${p.n}</td>
      <td><input type="date" value="${p.date||''}"></td>
      <td><input type="number" step="0.01" value="${p.amount||0}"></td>
      <td><input type="text" value="${escA(p.note||'')}"></td>`;
    const inputs=tr.querySelectorAll('input');
    const chk=inputs[0], dateInp=inputs[1], sumInp=inputs[2], noteInp=inputs[3];

    chk.addEventListener('change', ()=>{
      p.ok = chk.checked;
      if(p.ok && !p.date){ p.date=todayISO(); dateInp.value=p.date; }
      updateComputed(tr.closest('.ob-card'), item);
    });

    dateInp.addEventListener('input', ()=>{
      const v = (dateInp.value || '').trim();
      p.date = toIsoOrNull(v) || '';
      updateComputed(tr.closest('.ob-card'), item);
    });

    sumInp.addEventListener('input',  ()=>{ p.amount=toNum(sumInp.value, 0); updateComputed(tr.closest('.ob-card'), item); });
    noteInp.addEventListener('input', ()=>{ p.note=noteInp.value; });

    return tr;
  }

  /* ---------------- Chart ---------------- */
  function attachChart(root,item){
    const canvas=root.querySelector('canvas');
    const tip=root.querySelector('.ob-tip');

    function sectorAt(e){
      const rect=canvas.getBoundingClientRect();
      const x=e.clientX-rect.left, y=e.clientY-rect.top;
      const cx=canvas.width/2, cy=canvas.height/2;
      const dx=x*canvas.width/rect.width - cx;
      const dy=y*canvas.height/rect.height - cy;
      const r=Math.hypot(dx,dy);
      const outR=canvas.width/2 - 6;
      const inR=outR*0.62;
      if(r<inR || r>outR) return null;
      const ang=(Math.atan2(dy,dx)+Math.PI*2+Math.PI/2)%(Math.PI*2);
      const total=+root._total||0;
      const paidP=+root._paidPrincipal||0;
      const paidAng= total>0 ? (Math.PI*2)*paidP/total : 0;
      return ang<=paidAng ? 'paid' : 'rest';
    }

    canvas.addEventListener('mousemove',e=>{
      const hit=sectorAt(e);
      if(!hit){ tip.hidden=true; return; }
      const total=+root._total||0;
      const paidP=+root._paidPrincipal||0;
      const remain=Math.max(total-paidP,0);
      const val = hit==='paid' ? paidP : remain;
      const pct = total>0 ? Math.round(val/total*100) : 0;
      tip.innerHTML = `<b>${hit==='paid'?'Выплачено тела':'Осталось (тело)'}</b><br>${money(val)} (${pct}%)`;
      tip.hidden=false;
      const r=canvas.getBoundingClientRect();
      tip.style.left = `${e.clientX - r.left}px`;
      tip.style.top  = `${e.clientY - r.top}px`;
    });
    canvas.addEventListener('mouseleave',()=>tip.hidden=true);
  }

  function drawChart(canvas, paidPrincipal, total, pct){
    const root = canvas?.closest('.ob-card');
    const ctx=canvas.getContext('2d');
    const outR=canvas.width/2 - 6;
    const inR=outR*0.62;

    root._paidPrincipal = paidPrincipal;
    root._total = total;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    const cx=canvas.width/2, cy=canvas.height/2;

    const colorPaid = cssVar('--ob-primary') || '#6c72ff';
    const colorRest = cssVar('--ob-ring')    || '#e9ebf2';
    const colorHole = cssVar('--ob-panel')   || '#fff';
    const colorStroke = cssVar('--ob-border')|| '#e6e8ef';

    ctx.lineWidth = outR-inR;
    // фон
    ctx.strokeStyle = colorRest;
    ctx.beginPath(); ctx.arc(cx,cy,(outR+inR)/2,-Math.PI/2,1.5*Math.PI); ctx.stroke();

    const a = total>0 ? (Math.PI*2)*(paidPrincipal/total) : 0;
    if(a>0){
      ctx.strokeStyle = colorPaid;
      ctx.beginPath(); ctx.arc(cx,cy,(outR+inR)/2,-Math.PI/2,-Math.PI/2 + a); ctx.stroke();
    }

    // отверстие
    ctx.beginPath(); ctx.fillStyle=colorHole; ctx.strokeStyle=colorStroke;
    ctx.lineWidth=1; ctx.arc(cx,cy,inR,0,Math.PI*2); ctx.fill(); ctx.stroke();

    // проценты в центре
    const show = Math.round(pct||0);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ob-muted') || '#667085';
    ctx.font = '800 20px ui-sанс-serif, system-ui, -apple-system, Segoe UI';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(show+'%', cx, cy);
  }

  /* ---------------- hotkeys ---------------- */
  function bindHotkeys() {
    document.addEventListener('keydown', (e) => {
      const activeModal = document.querySelector('.modal[style*="flex"]');
      const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
      
      if (activeModal || isTyping) return; // Не обрабатываем горячие клавиши в модалках или при вводе
      
      switch (e.key.toLowerCase()) {
        case 'r':
          e.preventDefault();
          $('#refreshBtn')?.click();
          break;
        case 't':
          e.preventDefault();
          $('#themeToggle')?.click();
          break;
        case 's':
          e.preventDefault();
          $('#toggleAllBtn')?.click();
          break;
        case '?':
        case '/':
          e.preventDefault();
          if (e.key === '?') {
            $('#helpBtn')?.click();
          } else {
            $('#searchInput')?.focus();
          }
          break;
      }
    });
  }

  /* ---------------- auth status ---------------- */
  function setAuthStatus() {
    const authStatus = $('#authStatus');
    if (authStatus) {
      const name = localStorage.getItem('pf_tg_username') || localStorage.getItem('pf_email') || 'Гость';
      authStatus.textContent = name;
    }
  }

  /* ---------------- init ---------------- */
  (async ()=>{
    setAuthStatus();       // <<< установка статуса пользователя
    bindTopbar();          // <<< починили кнопки верхней панели
    bindSectionToggle();   // <<< стрелка «Мои обязательства»
    bindHotkeys();         // <<< горячие клавиши
    await loadAndRender();

    // Компактный режим для обязательств
    document.getElementById('compactToggle')?.addEventListener('click', ()=>{
      const body = document.body;
      const isCompact = body.classList.contains('compact-mode');
      
      if (isCompact) {
        body.classList.remove('compact-mode');
        localStorage.setItem('pf_compact', 'false');
        document.getElementById('compactToggle').textContent = '📱';
      } else {
        body.classList.add('compact-mode');
        localStorage.setItem('pf_compact', 'true');
        document.getElementById('compactToggle').textContent = '📄';
      }
    });

  // Загружаем сохраненный режим
  if (localStorage.getItem('pf_compact') === 'true') {
    document.body.classList.add('compact-mode');
    document.getElementById('compactToggle').textContent = '📄';
  }

  // Инициализируем плашку до оплаты кредитов
  initPaymentCountdown();

  // ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======
  const fmtMoney = (v, cur='RUB', d=2) => new Intl.NumberFormat('ru-RU', {style:'currency', currency:cur, maximumFractionDigits:d}).format(Number(v||0));

  // ====== ПЛАШКА ДО ОПЛАТЫ КРЕДИТОВ ======
  function initPaymentCountdown() {
    // Удаляем старую плашку если есть
    const oldCountdown = document.getElementById('paymentCountdown');
    if (oldCountdown) {
      oldCountdown.remove();
    }

    // Создаем плашку до оплаты кредитов
    const countdownElement = document.createElement('div');
    countdownElement.id = 'paymentCountdown';
    countdownElement.className = 'payment-countdown';
    countdownElement.title = 'Нажмите для просмотра деталей кредитов';
    
    // Добавляем стили
    countdownElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      background: var(--card);
      border: 1px solid var(--stroke);
      border-radius: 12px;
      padding: 12px 16px;
      min-width: 180px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      transition: all 0.3s ease;
      cursor: pointer;
    `;

    countdownElement.innerHTML = `
      <div class="countdown-header">
        <div class="countdown-label">ДО ОПЛАТЫ КРЕДИТА:</div>
      </div>
      <div class="countdown-time" id="paymentCountdownTime">--</div>
      <div class="countdown-progress">
        <div class="progress-bar" id="paymentProgressBar"></div>
      </div>
    `;

    // Добавляем в DOM
    document.body.appendChild(countdownElement);

    // Обновляем при изменении данных
    updatePaymentCountdown();

    // Обработчики событий
    countdownElement.addEventListener('mouseenter', handleMouseEnter);
    countdownElement.addEventListener('mouseleave', handleMouseLeave);
    countdownElement.addEventListener('click', handleClick);

    // Показываем/скрываем при скролле
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        countdownElement.style.transform = 'translateY(100px)';
        countdownElement.style.opacity = '0.5';
      } else {
        countdownElement.style.transform = 'translateY(0)';
        countdownElement.style.opacity = '1';
      }
      lastScrollY = currentScrollY;
    });
  }

  function updatePaymentCountdown() {
    const countdownElement = document.getElementById('paymentCountdownTime');
    const progressBar = document.getElementById('paymentProgressBar');
    
    if (!countdownElement || !progressBar) return;

    // Находим ближайший платеж
    const nearestPayment = findNearestPayment();
    
    if (!nearestPayment) {
      countdownElement.textContent = 'Нет платежей';
      progressBar.style.width = '0%';
      return;
    }

    const now = new Date();
    const timeDiff = nearestPayment.nextDate.getTime() - now.getTime();
    
    if (timeDiff <= 0) {
      countdownElement.textContent = 'Сегодня!';
      progressBar.style.width = '100%';
      progressBar.style.background = 'var(--ok)';
      return;
    }

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    // Форматирование времени
    let timeText = '';
    if (days > 0) {
      timeText = `${days} дн.`;
    } else if (hours > 0) {
      timeText = `${hours} ч.`;
    } else {
      timeText = `${minutes} мин.`;
    }

    countdownElement.textContent = timeText;

    // Прогресс-бар (показываем прогресс до следующего платежа)
    const totalDays = nearestPayment.intervalDays || 30;
    const daysPassed = totalDays - days;
    const progress = Math.max(0, Math.min(100, (daysPassed / totalDays) * 100));
    progressBar.style.width = `${progress}%`;

    // Цвет прогресс-бара
    if (days <= 3) {
      progressBar.style.background = 'var(--danger)';
    } else if (days <= 7) {
      progressBar.style.background = 'var(--warn)';
    } else {
      progressBar.style.background = 'var(--ok)';
    }
  }

  function findNearestPayment() {
    if (!items || items.length === 0) return null;

    const now = new Date();
    let nearest = null;
    let minDays = Infinity;

    items.forEach(item => {
      // Проверяем только кредиты (по названию)
      const isCredit = item.title.toLowerCase().includes('кредит') || 
                      item.title.toLowerCase().includes('займ') ||
                      item.title.toLowerCase().includes('ипотека') ||
                      item.title.toLowerCase().includes('автокредит');

      if (!isCredit) return;

      // Пытаемся найти дату следующего платежа
      const nextDate = calculateNextPaymentDate(item);
      if (!nextDate) return;

      const daysDiff = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff < minDays && daysDiff >= 0) {
        minDays = daysDiff;
        nearest = {
          item,
          nextDate,
          daysLeft: daysDiff,
          intervalDays: 30 // По умолчанию 30 дней между платежами
        };
      }
    });

    return nearest;
  }

  function calculateNextPaymentDate(item) {
    // Пытаемся найти дату в названии или описании
    const text = `${item.title} ${item.notes || ''}`;
    
    // Ищем паттерны дат
    const datePatterns = [
      /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/,  // DD.MM.YYYY
      /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2})/,   // DD.MM.YY
      /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/,   // YYYY.MM.DD
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        let day, month, year;
        
        if (pattern.source.includes('(\\d{4})')) {
          // YYYY.MM.DD
          year = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          day = parseInt(match[3]);
        } else {
          // DD.MM.YYYY или DD.MM.YY
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          year = parseInt(match[3]);
          if (year < 100) year += 2000;
        }

        const date = new Date(year, month, day);
        if (date > new Date()) {
          return date;
        }
      }
    }

    // Если дата не найдена, используем текущую дату + 30 дней
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    return defaultDate;
  }

  // Простые обработчики событий
  function handleMouseEnter() {
    console.log('Mouse enter - показываем tooltip');
    showSimpleTooltip();
  }

  function handleMouseLeave() {
    console.log('Mouse leave - скрываем tooltip');
    hideSimpleTooltip();
  }

  function handleClick() {
    console.log('Click - показываем модалку');
    showSimpleModal();
  }

  function showSimpleTooltip() {
    const credits = getCredits();
    if (credits.length === 0) return;

    const nearest = getNearestCredit(credits);
    if (!nearest) return;

    const tooltip = document.createElement('div');
    tooltip.id = 'simpleTooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: var(--card);
      border: 1px solid var(--stroke);
      border-radius: 8px;
      padding: 8px 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1001;
      font-size: 12px;
      max-width: 250px;
    `;

    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">💳 ${nearest.credit.title}</div>
      <div style="color: var(--muted); font-size: 11px;">Остаток: ${fmtMoney(nearest.credit.remaining || 0)}</div>
      <div style="color: var(--accent); font-weight: bold;">${nearest.daysLeft} дней до оплаты</div>
    `;

    document.body.appendChild(tooltip);
    positionTooltip(tooltip);
  }

  function hideSimpleTooltip() {
    const tooltip = document.getElementById('simpleTooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  function positionTooltip(tooltip) {
    const countdown = document.getElementById('paymentCountdown');
    if (!countdown) return;

    const countdownRect = countdown.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let left = countdownRect.left + (countdownRect.width / 2) - (tooltipRect.width / 2);
    let top = countdownRect.top - tooltipRect.height - 10;

    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top < 10) {
      top = countdownRect.bottom + 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function showSimpleModal() {
    const credits = getCredits();
    if (credits.length === 0) {
      toast('Нет кредитов для отображения', 'info');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    const creditsHtml = credits.map(credit => {
      const nextDate = calculateNextPaymentDate(credit);
      const now = new Date();
      const daysLeft = nextDate ? Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      return `
        <div style="padding: 12px; border: 1px solid var(--stroke); border-radius: 8px; margin-bottom: 8px;">
          <div style="font-weight: bold; margin-bottom: 4px;">${credit.title}</div>
          <div style="color: var(--muted); font-size: 14px; margin-bottom: 4px;">Остаток: ${fmtMoney(credit.remaining || 0)}</div>
          <div style="color: var(--accent); font-weight: bold;">${daysLeft} дней до оплаты</div>
          ${nextDate ? `<div style="color: var(--muted); font-size: 12px;">Дата: ${nextDate.toLocaleDateString('ru-RU')}</div>` : ''}
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="modal__dialog" style="max-width: 500px;">
        <div class="modal__header">
          <h3>💳 Ваши кредиты</h3>
          <button class="modal__close" onclick="this.closest('.modal').remove()">✕</button>
        </div>
        <div class="modal__body">
          ${creditsHtml}
          <div style="text-align: center; margin-top: 20px;">
            <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Закрыть</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
  }

  function getCredits() {
    if (!items || items.length === 0) return [];
    
    return items.filter(item => {
      const title = item.title.toLowerCase();
      return title.includes('кредит') || 
             title.includes('займ') ||
             title.includes('ипотека') ||
             title.includes('автокредит');
    });
  }

  function getNearestCredit(credits) {
    let nearest = null;
    let minDays = Infinity;

    credits.forEach(credit => {
      const nextDate = calculateNextPaymentDate(credit);
      if (!nextDate) return;

      const now = new Date();
      const daysLeft = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft < minDays && daysLeft >= 0) {
        minDays = daysLeft;
        nearest = { credit, daysLeft };
      }
    });

    return nearest;
  }

  // Обновляем плашку при изменении данных
  const originalRender = render;
  render = function() {
    console.log('Render called, updating payment countdown');
    originalRender();
    updatePaymentCountdown();
  };

  // Добавляем глобальные функции для отладки
  window.debugPaymentCountdown = {
    getCredits: getCredits,
    getNearestCredit: getNearestCredit,
    showTooltip: showSimpleTooltip,
    showModal: showSimpleModal,
    update: updatePaymentCountdown
  };

  })();

})();
