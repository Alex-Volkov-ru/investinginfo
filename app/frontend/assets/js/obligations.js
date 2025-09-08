(() => {
    'use strict';
  
    /* ---------------- utils ---------------- */
    const $ = (s, r=document) => r.querySelector(s);
    const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
    const nf = new Intl.NumberFormat('ru-RU');
    const money = n => nf.format(Math.round(Number(n)||0));
    const escH = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const escA = s => String(s).replace(/"/g,'&quot;');
    const todayISO = () => new Date().toISOString().slice(0,10);
    const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || name;
    const clone = obj => JSON.parse(JSON.stringify(obj));
  
    /* ---------------- верхняя панель (аккуратно, без ломки макета) ---------------- */
    try{
      const themeToggle=$('#themeToggle'), refreshBtn=$('#refreshBtn'),
            helpBtn=$('#helpBtn'), helpModal=$('#helpModal'),
            helpCloseX=$('#helpCloseX'), helpCloseBtn=$('#helpCloseBtn'),
            toggleAll=$('#toggleAllBtn'), search=$('#searchInput');
  
      const HTML=document.documentElement, THEME_LS='pf_theme';
      const setTheme=t=>{ HTML.setAttribute('data-theme',t); try{localStorage.setItem(THEME_LS,t)}catch{} };
      try{ const saved=localStorage.getItem(THEME_LS); if(saved) setTheme(saved);}catch{}
  
      themeToggle?.addEventListener('click',()=>setTheme((HTML.getAttribute('data-theme')||'dark')==='dark'?'light':'dark'));
      refreshBtn?.addEventListener('click',()=>location.reload());
      const openHelp=()=>{ if(!helpModal) return; helpModal.style.display='flex'; document.body.style.overflow='hidden'; };
      const closeHelp=()=>{ if(!helpModal) return; helpModal.style.display='';    document.body.style.overflow=''; };
      helpBtn?.addEventListener('click',openHelp);
      helpCloseX?.addEventListener('click',closeHelp);
      helpCloseBtn?.addEventListener('click',closeHelp);
      helpModal?.addEventListener('click',e=>{ if(e.target===helpModal) closeHelp(); });
  
      toggleAll?.addEventListener('click',()=>{
        const sections = $$('.section');
        const hasClosed = sections.some(s=>!s.classList.contains('open'));
        sections.forEach(s=> s.classList.toggle('open', hasClosed));
      });
  
      document.addEventListener('keydown',e=>{
        if(e.key==='/' && document.activeElement!==search){ e.preventDefault(); search?.focus(); }
        if(e.key==='?' && !e.ctrlKey && !e.metaKey && !e.altKey){ e.preventDefault(); openHelp(); }
      });
    }catch(e){ console.error('[header]', e); }
  
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
  
    /* ---------------- axios / api ---------------- */
    const token = localStorage.getItem('pf_token');
    if (!token) { window.location.href = 'login.html'; return; }
    const isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
    const baseURL = isLocal ? 'http://127.0.0.1:8000/api' : '/api';
    const api = axios.create({ baseURL, timeout: 20000 });
    api.interceptors.request.use(cfg => { cfg.headers = cfg.headers || {}; cfg.headers.Authorization = `Bearer ${token}`; return cfg; });
  
    // map API <-> UI
    const fromApi = (row) => ({
      id: row.id,
      title: row.title || 'Обязательство',
      total: Number(row.total||0),
      monthly: Number(row.monthly||0),
      rate: Number(row.rate||0),
      dueDay: Number(row.due_day||15),
      nextPayment: row.next_payment || '',
      closeDate: row.close_date || '',
      status: row.status || 'Активный',
      notes: row.notes || '',
      payments: (row.payments||[]).map(p => ({
        id: p.id, n: Number(p.n), ok: !!p.ok, date: p.date || '', amount: Number(p.amount||0), note: p.note || ''
      })),
    });
  
    const toApi = (item) => ({
      id: item.id,
      title: (item.title || '').trim() || 'Обязательство',
      total: Number(item.total||0),
      monthly: Number(item.monthly||0),
      rate: Number(item.rate||0),
      due_day: Number(item.dueDay||15),
      next_payment: item.nextPayment || null,
      close_date: item.closeDate || null,
      status: item.status || 'Активный',
      notes: item.notes || '',
      payments: (item.payments||[]).map(p => ({
        id: p.id, n: Number(p.n), ok: !!p.ok, date: p.date || null, amount: Number(p.amount||0), note: p.note || ''
      })),
    });
  
    async function apiList(){ const {data}=await api.get('/budget/obligation-blocks'); return data.map(fromApi); }
    async function apiCreate(title){
      const {data}=await api.post('/budget/obligation-blocks', { title: (title||'').trim() || 'Обязательство' });
      return fromApi(data);
    }
    async function apiUpdate(item){
      const {data}=await api.put(`/budget/obligation-blocks/${item.id}`, toApi(item));
      return fromApi(data);
    }
    async function apiDelete(id){ await api.delete(`/budget/obligation-blocks/${id}`); }
  
    /* ---------------- состояние ---------------- */
    const el = {
      section: $('#obSection'),
      list: $('#obList'),
      empty: $('#obEmpty'),
      search: $('#searchInput'),
      addBtn: $('#addObBtn'),
      m: $('#createObModal'), mInput: $('#createNameInput'),
      mOk: $('#createCreateBtn'), mCancel: $('#createCancelBtn'), mCloseX: $('#createCloseX'),
    };
    if (!el.list || !el.addBtn) return;
  
    let items = []; // тут храним то, что пришло с сервера
  
    // загрузка
    async function loadAndRender(){
      try {
        items = await apiList();
        render();
      } catch (err){
        console.error(err);
        toast(err?.response?.data?.detail || 'Ошибка загрузки', 'err', 3600);
      }
    }
  
    /* ---------------- модалка создания ---------------- */
    const openCreate=()=>{ el.m.style.display='flex'; document.body.style.overflow='hidden'; setTimeout(()=>el.mInput?.focus(),30); };
    const closeCreate=()=>{ el.m.style.display='none'; document.body.style.overflow=''; };
    el.addBtn.addEventListener('click', ()=>{ el.mInput.value=''; openCreate(); });
    el.mCancel?.addEventListener('click', closeCreate);
    el.mCloseX?.addEventListener('click', closeCreate);
    el.m?.addEventListener('click', e=>{ if(e.target===el.m) closeCreate(); });
    el.mInput?.addEventListener('keydown', e=>{ if(e.key==='Enter') el.mOk?.click(); });
  
    el.mOk?.addEventListener('click', async ()=>{
      const name = (el.mInput.value||'').trim();
      try{
        const created = await apiCreate(name);
        items.unshift(created);
        render();
        closeCreate(); toast('Создано');
        el.section?.classList.add('open');
        if (el.search) el.search.value='';
      }catch(err){
        console.error(err); toast(err?.response?.data?.detail || 'Не удалось создать', 'err', 3600);
      }
    });
  
    /* ---------------- вычислялки ---------------- */
    const compute = it => {
      const paid = (it.payments||[]).filter(p=>p.ok).reduce((s,p)=>s+(+p.amount||0),0);
      const total = +it.total||0;
      const remain = Math.max(total-paid,0);
      const pct = total>0 ? Math.round(paid/total*100) : 0;
      return {paid,remain,pct};
    };
  
    /* ---------------- поиск + рендер ---------------- */
    el.search?.addEventListener('input', render);
  
    function render(){
      el.list.innerHTML = '';
      const q=(el.search?.value||'').toLowerCase();
      const rows = items.filter(x=>!q || x.title.toLowerCase().includes(q) || (x.notes||'').toLowerCase().includes(q));
      el.empty.style.display = rows.length ? 'none' : '';
      rows.forEach(it => el.list.appendChild(renderCard(it)));
    }
  
    function renderCard(item){
      const {paid,remain,pct}=compute(item);
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
          <div class="ob-stat"><div class="ob-stat__label">Осталось оплатить</div><div class="ob-stat__val" data-bind="remain">${money(remain)}</div></div>
          <div class="ob-stat"><div class="ob-stat__label">Оплачено в %</div><div class="ob-stat__val" data-bind="pct">${pct}%</div></div>
          <div class="ob-stat"><div class="ob-stat__label">Оплачено всего</div><div class="ob-stat__val" data-bind="paid">${money(paid)}</div></div>
        </div>
  
        <div class="ob-body">
          <!-- Блок полей -->
          <div class="ob-block">
            <table class="ob-kv"><tbody>
              ${kv('Сумма долга общая','total',item.total)}
              ${kv('Ежемесячный платёж','monthly',item.monthly)}
              ${kv('% по кредиту','rate',item.rate,'number','step="0.1"')}
              ${kv('Платёж не позднее — числа','dueDay',item.dueDay,'number','min="1" max="31"')}
              ${kv('Следующий платёж','nextPayment',item.nextPayment,'date')}
              ${kv('Дата закрытия','closeDate',item.closeDate,'date')}
              <tr><th>Статус</th><td><select class="input" data-key="status">
                ${['Активный','Просрочен','Закрыт'].map(s=>`<option ${s===item.status?'selected':''}>${s}</option>`).join('')}
              </select></td></tr>
              <tr><th>Заметки</th><td><input class="input" data-key="notes" value="${escA(item.notes||'')}" placeholder="Комментарий…"></td></tr>
            </tbody></table>
          </div>
  
          <!-- График -->
          <div class="ob-block">
            <div class="ob-chart">
              <canvas width="260" height="260"></canvas>
              <div class="ob-tip" hidden></div>
            </div>
          </div>
  
          <!-- Таблица платежей -->
          <div class="ob-block">
            <table class="ob-pay">
              <thead><tr>
                <th class="ob-col-done">✓</th>
                <th style="width:48px;">№</th>
                <th class="ob-col-date">Дата платежа</th>
                <th class="ob-col-sum">Сумма</th>
                <th>Заметки</th>
              </tr></thead>
              <tbody></tbody>
            </table>
            <div style="margin-top:8px"><button class="btn" data-act="addRow">➕ Добавить строку</button></div>
          </div>
        </div>
      `;
  
      // сворачивание
      root.querySelector('.ob-card__toggle').addEventListener('click',()=> root.classList.toggle('collapsed'));
  
      // кнопки шапки
      root.querySelector('[data-act="save"]').addEventListener('click', async ()=>{
        try{
          const id = Number(root.dataset.id);
          const local = items.find(x=>Number(x.id)===id);
          const saved = await apiUpdate(local);
          // заменить локально тем, что вернул сервер (обновятся id платежей и т.п.)
          const idx = items.findIndex(x=>Number(x.id)===id);
          if (idx>=0) items[idx] = saved;
          render();
          toast('Сохранено');
        }catch(err){
          console.error(err); toast(err?.response?.data?.detail || 'Ошибка сохранения', 'err', 3600);
        }
      });
  
      root.querySelector('[data-act="rename"]').addEventListener('click', async ()=>{
        const name = prompt('Название блока', item.title);
        if (!name) return;
        item.title = name.trim();
        // только UI изменим, сохранение — по кнопке «Сохранить»
        root.querySelector('.ob-card__title').textContent = item.title;
      });
  
      root.querySelector('[data-act="duplicate"]').addEventListener('click', async ()=>{
        try{
          // 1) создаём пустой блок на сервере
          const created = await apiCreate(item.title + ' (копия)');
          // 2) копируем поля и платежи с оригинала и сохраняем
          const copy = clone(item);
          copy.id = created.id;
          // выравниваем номера n по порядку (и убираем серверные id из созданного)
          copy.payments = (copy.payments||[]).map((p,i)=>({ id: created.payments[i]?.id ?? p.id ?? null, n:i+1, ok:p.ok, date:p.date||null, amount:Number(p.amount||0), note:p.note||'' }));
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
  
      // поля
      root.querySelectorAll('[data-key]').forEach(inp=>{
        inp.addEventListener('input', e=>{
          const key=e.target.getAttribute('data-key');
          let val=e.target.value;
          if(['total','monthly','rate','dueDay'].includes(key)) val = Number(val || 0);
          if(key==='dueDay') val = Math.min(31, Math.max(1, val));
          item[key]=val;
          updateComputed(root,item);
        });
      });
  
      // платежи
      const tbody=root.querySelector('.ob-pay tbody');
      (item.payments||[]).forEach(p=>tbody.appendChild(renderRow(item,p)));
      root.querySelector('[data-act="addRow"]').addEventListener('click', ()=>{
        const p={ id:null, n:(item.payments?.length||0)+1, ok:false, date:'', amount:0, note:'' };
        item.payments = item.payments || [];
        item.payments.push(p);
        tbody.appendChild(renderRow(item,p));
        updateComputed(root,item);
      });
  
      // график
      attachChart(root, item);
  
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
        <td><input type="number" step="1" value="${p.amount||0}"></td>
        <td><input type="text" value="${escA(p.note||'')}"></td>`;
      const inputs=tr.querySelectorAll('input');
      const chk=inputs[0], dateInp=inputs[1], sumInp=inputs[2], noteInp=inputs[3];
  
      chk.addEventListener('change', ()=>{
        p.ok = chk.checked;
        if(p.ok && !p.date){ p.date=todayISO(); dateInp.value=p.date; }
        updateComputed(tr.closest('.ob-card'), item);
      });
      dateInp.addEventListener('input', ()=>{ p.date=dateInp.value; });
      sumInp.addEventListener('input',  ()=>{ p.amount=Number(sumInp.value||0); updateComputed(tr.closest('.ob-card'), item); });
      noteInp.addEventListener('input', ()=>{ p.note=noteInp.value; });
  
      return tr;
    }
  
    function updateComputed(root,item){
      const {paid,remain,pct}=compute(item);
      root.querySelector('[data-bind="paid"]').textContent   = money(paid);
      root.querySelector('[data-bind="remain"]').textContent = money(remain);
      root.querySelector('[data-bind="pct"]').textContent    = pct + '%';
      drawChart(root.querySelector('canvas'), paid, (+item.total||0));
    }
  
    /* ---------------- Canvas donut + tooltip ---------------- */
    function attachChart(root,item){
      const canvas=root.querySelector('canvas');
      const tip=root.querySelector('.ob-tip');
      const ctx=canvas.getContext('2d');
      const outR=canvas.width/2 - 6;
      const inR=outR*0.62;
  
      const colorPaid = cssVar('--ob-primary') || '#6c72ff';
      const colorRest = cssVar('--ob-ring')    || '#e9ebf2';
      const colorHole = cssVar('--ob-panel')   || '#fff';
      const colorStroke = cssVar('--ob-border')|| '#e6e8ef';
  
      function sectorAt(pt){
        const rect=canvas.getBoundingClientRect();
        const x=pt.clientX-rect.left, y=pt.clientY-rect.top;
        const cx=canvas.width/2, cy=canvas.height/2;
        const dx=x*canvas.width/rect.width - cx;
        const dy=y*canvas.height/rect.height - cy;
        const r=Math.hypot(dx,dy);
        if(r<inR || r>outR) return null;
        const ang=(Math.atan2(dy,dx)+Math.PI*2+Math.PI/2)%(Math.PI*2); // 0 сверху
        const total=+item.total||0;
        const paid=(item.payments||[]).filter(p=>p.ok).reduce((s,p)=>s+(+p.amount||0),0);
        const paidAng= total>0 ? (Math.PI*2)*paid/total : 0;
        return ang<=paidAng ? 'paid' : 'rest';
      }
  
      function updateTip(e){
        const hit=sectorAt(e);
        if(!hit){ tip.hidden=true; return; }
        const total=+item.total||0;
        const paid=(item.payments||[]).filter(p=>p.ok).reduce((s,p)=>s+(+p.amount||0),0);
        const remain=Math.max(total-paid,0);
        const val = hit==='paid' ? paid : remain;
        const pct = total>0 ? Math.round(val/total*100) : 0;
        tip.innerHTML = `<b>${hit==='paid'?'Оплачено':'Осталось'}</b><br>${money(val)} (${pct}%)`;
        tip.hidden=false;
        const r=canvas.getBoundingClientRect();
        tip.style.left = `${e.clientX - r.left}px`;
        tip.style.top  = `${e.clientY - r.top}px`;
      }
  
      canvas.addEventListener('mousemove',updateTip);
      canvas.addEventListener('mouseleave',()=>tip.hidden=true);
  
      drawChart(canvas,
        (item.payments||[]).filter(p=>p.ok).reduce((s,p)=>s+(+p.amount||0),0),
        (+item.total||0)
      );
  
      function drawHole(){
        ctx.beginPath(); ctx.fillStyle=colorHole; ctx.strokeStyle=colorStroke;
        ctx.lineWidth=1; ctx.arc(canvas.width/2,canvas.height/2,inR,0,Math.PI*2);
        ctx.fill(); ctx.stroke();
      }
      function drawChart(cv, paid, total){
        const c = cv.getContext('2d');
        c.clearRect(0,0,cv.width,cv.height);
        const cx=cv.width/2, cy=cv.height/2;
        // base ring
        c.lineWidth = outR-inR;
        c.strokeStyle = colorRest;
        c.beginPath(); c.arc(cx,cy,(outR+inR)/2,-Math.PI/2,1.5*Math.PI); c.stroke();
        // paid
        const a = total>0 ? (Math.PI*2)*(paid/total) : 0;
        if(a>0){
          c.strokeStyle = colorPaid;
          c.beginPath(); c.arc(cx,cy,(outR+inR)/2,-Math.PI/2,-Math.PI/2 + a); c.stroke();
        }
        drawHole();
        const pct = total>0 ? Math.round(paid/total*100) : 0;
        c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ob-muted') || '#667085';
        c.font = '800 20px ui-sans-serif, system-ui, -apple-system, Segoe UI';
        c.textAlign='center'; c.textBaseline='middle';
        c.fillText(pct+'%', cx, cy);
      }
      root._drawChart = drawChart; // hook
    }
  
    function drawChart(canvas, paid, total){
      const root = canvas?.closest('.ob-card');
      if(root && root._drawChart) root._drawChart(canvas, paid, total);
    }
  
    /* ---------------- init ---------------- */
    (async ()=>{
      await loadAndRender();
    })();
  })();
  