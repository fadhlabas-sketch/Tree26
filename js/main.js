/**
 * config.js
 */
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz5K9GBD8xmQiOa05dhY969mFGKgh_MrG0ADdmlPdkyCoZe8DAlmyvhcbDvaKPPibw/exec',
  ADMIN_PASSWORD: 'admin123',
};

/**
 * sheets.js
 */
const Sheets = (() => {
  async function _call(params) {
    const url = CONFIG.APPS_SCRIPT_URL;
    if (!url || url.includes('YOUR_APPS_SCRIPT')) {
      throw new Error('لم يتم تعيين رابط Apps Script');
    }
    let res;
    try {
      res = await fetch(`${url}?${new URLSearchParams(params)}`, { redirect: 'follow' });
    } catch (e) { throw new Error('تعذّر الاتصال'); }
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  }

  return {
    getMembers:     ()  => _call({ action: 'getMembers' }).then(d => d.members || []),
    getPendingReqs: ()  => _call({ action: 'getPendingRequests' }).then(d => d.requests || []),
    getPendingUpds: ()  => _call({ action: 'getPendingUpdates'  }).then(d => d.updates  || []),
    approveChild:   id  => _call({ action: 'approveAddChild',    requestId: id }),
    approveUpdate:  id  => _call({ action: 'approveUpdate',      requestId: id }),
    rejectReq:   (id,s) => _call({ action: 'rejectRequest',  requestId: id, sheet: s }),
    rejectUpd:      id  => _call({ action: 'rejectUpdate',       requestId: id }),
    directAddChild: p   => _call({ action: 'directAddChild',     ...p }),
    directUpdate:   p   => _call({ action: 'directUpdateMember', ...p }),
    submitAddChild: ({parentId,childName,birthYear,submittedBy}) =>
      _call({action:'addPendingRequest',type:'add_child',parentId,childName,birthDate:birthYear||'',submittedBy:submittedBy||'مجهول'}),
    submitUpdateDetails: ({memberId,memberName,birthDate,phone,address,job,note,submittedBy}) =>
      _call({action:'addPendingUpdate',memberId,memberName,birthDate:birthDate||'',phone:phone||'',address:address||'',job:job||'',note:note||'',submittedBy:submittedBy||'مجهول'}),
    deleteMember: (memberId) => _call({ action: 'deleteMember', memberId }),
  };
})();

/**
 * tree.js — شجرة أفقية واضحة مناسبة لـ 197 شخص
 * =================================================
 * - التخطيط: أفقي من اليسار (جذر) إلى اليمين (أحفاد)
 * - الأغصان: منحنيات Bezier ناعمة
 * - العقد: بيضاوية بنية خشبية مع الاسم
 * - مناسب لعائلات كبيرة (29 أبناً في المستوى الواحد)
 */
const Tree = (() => {

  let _members=[], _map={}, _svg=null, _g=null, _zoom=null, _initT=null;

  // أبعاد العقدة الأساسية (تُحسب ديناميكياً حسب طول الاسم)
  const NH  = 28;   // ارتفاع ثابت
  const PAD = 14;   // هامش أفقي داخل العقدة (يمين + يسار)
  const FONT_PX = 10.5;  // حجم الخط بالبكسل (تقريبي)
  // عرض العقدة = طول الاسم × معامل الخط + هامش
  function nodeWidth(name) {
    // معامل تقريبي لخط Cairo العربي
    return Math.max(52, Math.ceil((name||'').length * FONT_PX * 0.72) + PAD * 2);
  }

  function _buildMap(m) { _map={}; m.forEach(x=>(_map[x.id]=x)); }

  function _toHierarchy() {
    const roots = _members.filter(m => !m.parent_id || !_map[m.parent_id]);
    if (!roots.length) return null;
    const nodes={};
    _members.forEach(m=>(nodes[m.id]={...m,children:[]}));
    _members.forEach(m=>{ if(m.parent_id&&nodes[m.parent_id]) nodes[m.parent_id].children.push(nodes[m.id]); });
    if (roots.length===1) return nodes[roots[0].id];
    return {id:'__root__',name:'',children:roots.map(r=>nodes[r.id])};
  }

  function render(members) {
    _members=members; _buildMap(members);
    const wrap=document.getElementById('treeWrap');
    wrap.innerHTML='';
    const W=wrap.clientWidth||window.innerWidth;
    const H=wrap.clientHeight||window.innerHeight;
    // تأكد أن الـ SVG يملأ الحاوية
    if(wrap.clientHeight===0){
      wrap.style.height=(window.innerHeight-100)+'px';
    }

    _svg=d3.select('#treeWrap').append('svg').attr('width',W).attr('height',H);

    // ── تعاريف SVG ──
    const defs=_svg.append('defs');

    // تدرج خشبي بني
    const rg=defs.append('radialGradient').attr('id','wg')
      .attr('cx','40%').attr('cy','35%').attr('r','60%');
    rg.append('stop').attr('offset','0%') .attr('stop-color','#e8c88a');
    rg.append('stop').attr('offset','45%').attr('stop-color','#a86828');
    rg.append('stop').attr('offset','85%').attr('stop-color','#6a3808');
    rg.append('stop').attr('offset','100%').attr('stop-color','#3a1800');

    // ظل خفيف
    const fl=defs.append('filter').attr('id','sh')
      .attr('x','-20%').attr('y','-30%').attr('width','140%').attr('height','160%');
    fl.append('feDropShadow').attr('dx',0).attr('dy',1.5)
      .attr('stdDeviation',2).attr('flood-color','rgba(0,0,0,.28)');

    // ── حاوية رئيسية ──
    _g = _svg.append('g');

    // (مستمع الإخفاء موجود على document في نهاية render)

    const hierData=_toHierarchy();
    if (!hierData) return;

    const root=d3.hierarchy(hierData, d=>d.children&&d.children.length?d.children:null);
    const count=root.descendants().length;

    // حجم الفراغ بين العقد يتكيف مع الكثافة
    const vSpace = count>150 ? 30 : count>80 ? 36 : count>40 ? 42 : 48;
    const hSpace = count>150 ? 130 : count>80 ? 140 : 155;

    // تخطيط أفقي: x=عمق(أفقي)، y=ترتيب(رأسي)
    d3.tree().nodeSize([vSpace, hSpace])(root);

    // قلب المحاور لتصبح الشجرة أفقية (الجذر يسار)
    root.descendants().forEach(d => { const t=d.x; d.x=d.y; d.y=t; });

    // ── رسم الأغصان ──
    _g.append('g').attr('class','branches')
      .selectAll('path')
      .data(root.links().filter(d=>d.source.data.id!=='__root__'))
      .enter().append('path')
      .attr('class','br')
      .attr('data-parent', d=>d.source.data.id)
      .attr('data-child',  d=>d.target.data.id)
      .attr('stroke-width', d=>Math.max(1, 3.5 - d.source.depth*0.5))
      .attr('d', d=>{
        // نقطة البداية: يمين عقدة الأب (حسب عرضها)
        const srcW = nodeWidth(d.source.data.name);
        const tgtW = nodeWidth(d.target.data.name);
        const x1 = d.source.x + srcW/2;
        const y1 = d.source.y;
        // نقطة النهاية: يسار عقدة الابن
        const x2 = d.target.x - tgtW/2;
        const y2 = d.target.y;
        const mx = (x1+x2)/2;
        return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
      });

    // ── رسم العقد ──
    const ng=_g.append('g').attr('class','nodes')
      .selectAll('g.ng')
      .data(root.descendants().filter(d=>d.data.id!=='__root__'))
      .enter().append('g')
      .attr('class','ng')
      .attr('data-id', d=>d.data.id)
      // المركز الرأسي ثابت، الأفقي يعتمد على عرض العقدة
      .attr('transform', d=>{
        const nw = nodeWidth(d.data.name);
        return `translate(${d.x - nw/2},${d.y - NH/2})`;
      });

    // البيضاوية — عرضها يتكيف مع الاسم
    ng.append('rect').attr('class','no')
      .attr('width',  d => nodeWidth(d.data.name))
      .attr('height', NH)
      .attr('rx', NH/2).attr('ry', NH/2)
      .attr('fill','url(#wg)')
      .style('filter','url(#sh)');

    // الاسم كامل في المنتصف
    ng.append('text').attr('class','nl')
      .attr('x', d => nodeWidth(d.data.name) / 2)
      .attr('y', NH / 2)
      .attr('dy', '.35em')
      .text(d => d.data.name || '');

    // منطقة نقر
    ng.append('rect').attr('class','nh')
      .attr('width',  d => nodeWidth(d.data.name) + 10)
      .attr('height', NH + 10)
      .attr('x', -5).attr('y', -5)
      .attr('rx', NH/2 + 5).attr('ry', NH/2 + 5)
      .on('mousedown',  function(e,d){ e.stopPropagation(); _startPress(d.data.id,e.clientX,e.clientY); })
      .on('mouseup',    function(e,d){ e.stopPropagation(); _endPress(d.data.id,e.clientX,e.clientY,false); })
      .on('mouseleave', function()   { _cancelPress(); })
      .on('touchstart', function(e,d){ e.stopPropagation();
        const t=e.touches[0]; _startPress(d.data.id,t.clientX,t.clientY); },{passive:true})
      .on('touchend',   function(e,d){ e.preventDefault(); e.stopPropagation();
        const t=e.changedTouches[0]; _endPress(d.data.id,t.clientX,t.clientY,true); })
      .on('touchmove',  function(e,d){ _cancelPress(); },{passive:true});

    // ── ملء الشاشة تلقائياً ──
    _autoFit(W,H,root);

    // ── zoom/pan ──
    _zoom=d3.zoom().scaleExtent([0.04,6])
      .on('zoom',e=>_g.attr('transform',e.transform));
    _svg.call(_zoom).on('dblclick.zoom',null);

    if (_initT) _svg.call(_zoom.transform,_initT);

    // مستمع الإخفاء على document (يُسجَّل مرة واحدة)
    document.removeEventListener('pointerup', _docClear);
    document.addEventListener('pointerup', _docClear);
  }

  // ── متغيرات تتبع الحركة ──
  let _ptrDownX = 0, _ptrDownY = 0, _ptrMoved = false;

  document.addEventListener('pointerdown', e => {
    _ptrDownX = e.clientX;
    _ptrDownY = e.clientY;
    _ptrMoved = false;
  }, { passive: true });

  document.addEventListener('pointermove', e => {
    if (Math.abs(e.clientX - _ptrDownX) > 6 ||
        Math.abs(e.clientY - _ptrDownY) > 6) {
      _ptrMoved = true;
    }
  }, { passive: true });

  // إخفاء السلالة فقط عند نقر حقيقي (بدون حركة) على فراغ
  function _docClear(e) {
    if (_ptrMoved) return;   // كان سحباً أو زوماً → تجاهل
    if (e.target.closest('.nh')) return;          // عقدة
    if (e.target.closest('#ctxMenu')) return;      // القائمة
    if (e.target.closest('.modal-box')) return;    // نافذة
    if (e.target.closest('.detail-panel')) return; // لوحة التفاصيل
    clearLineage();
  }

  // ══════════════════════════════════════════════════════════
  //  منطق النقر والضغط المطوّل
  //  - نقرة سريعة  → إظهار مسار الأصل
  //  - ضغط مطوّل (700ms) → القائمة
  //  - نقر على فراغ → إخفاء المسار
  // ══════════════════════════════════════════════════════════
  let _pressTimer  = null;
  let _pressId     = null;
  let _pressMoved  = false;

  function _startPress(id, x, y) {
    _pressId    = id;
    _pressMoved = false;
    clearTimeout(_pressTimer);
    _pressTimer = setTimeout(() => {
      // ضغط مطوّل → القائمة
      if (!_pressMoved) {
        if (navigator.vibrate) navigator.vibrate(45);
        UI.showMenu(id, x, y);
      }
      _pressId = null;
    }, 700);
  }

  function _endPress(id, x, y, isTouch) {
    const wasLong = !_pressId;  // إذا انتهت المهلة → كان مطوّلاً
    clearTimeout(_pressTimer);
    if (_pressMoved || wasLong) { _pressId=null; return; }

    // نقرة سريعة → مسار الأصل
    _pressId = null;
    _showLineageOnly(id);
  }

  function _cancelPress() {
    clearTimeout(_pressTimer);
    _pressMoved = true;
    _pressId    = null;
  }

  function _showLineageOnly(id) {
    // احسب السلالة
    const ancs = new Set();
    let cur = id;
    while (cur) {
      ancs.add(cur);
      const m = _map[cur];
      cur = m?.parent_id && _map[m.parent_id] ? m.parent_id : null;
    }
    // إزالة أي تمييز سابق
    clearLineage();
    // تمييز العقد
    ancs.forEach(a =>
      d3.select(`g.ng[data-id="${a}"]`).classed('lin', true)
    );
    // تمييز الأغصان
    d3.selectAll('path.br').each(function(d) {
      if (ancs.has(d?.source?.data?.id) && ancs.has(d?.target?.data?.id))
        d3.select(this).classed('lin', true);
    });
  }

  function _autoFit(W,H,root) {
    // احسب الحدود الحقيقية مع الأخذ بعرض كل عقدة
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    root.descendants().forEach(d=>{
      if(d.data.id==='__root__') return;
      const nw=nodeWidth(d.data.name);
      if(d.x - nw/2 < x0) x0=d.x - nw/2;
      if(d.x + nw/2 > x1) x1=d.x + nw/2;
      if(d.y - NH/2 < y0) y0=d.y - NH/2;
      if(d.y + NH/2 > y1) y1=d.y + NH/2;
    });
    const pad=24;
    const tW=x1-x0+pad*2;
    const tH=y1-y0+pad*2;
    const sc=Math.min((W-8)/tW,(H-8)/tH,1.8);
    const tx=W/2-((x0+x1)/2)*sc;
    const ty=H/2-((y0+y1)/2)*sc;
    _initT=d3.zoomIdentity.translate(tx,ty).scale(sc);
    if(_svg&&_zoom) _svg.call(_zoom.transform,_initT);
  }

  function centreOnNode(id) {
    if(!_svg||!_zoom) return;
    const el=document.querySelector(`g.ng[data-id="${id}"]`);
    if(!el) return;
    const W=document.getElementById('treeWrap').clientWidth;
    const H=document.getElementById('treeWrap').clientHeight;
    const bb=el.getBoundingClientRect();
    const cx=bb.left+bb.width/2;
    const cy=bb.top+bb.height/2;
    const cur=d3.zoomTransform(_svg.node());
    _svg.transition().duration(500).call(_zoom.transform,
      d3.zoomIdentity
        .translate(cur.x+W/2-cx, cur.y+H/2-cy)
        .scale(cur.k)
    );
  }

  function centreOnRoot() {
    if(_svg&&_zoom&&_initT)
      _svg.transition().duration(400).call(_zoom.transform,_initT);
  }

  function highlight(id) {
    d3.selectAll('g.ng').classed('hl',false);
    d3.select(`g.ng[data-id="${id}"]`).classed('hl',true);
  }

  function highlightLineage(id) {
    clearLineage();
    const a=new Set(); let c=id;
    while(c){ a.add(c); const m=_map[c]; c=m?.parent_id&&_map[m.parent_id]?m.parent_id:null; }
    a.forEach(x=>d3.select(`g.ng[data-id="${x}"]`).classed('ln',true));
    d3.selectAll('path.br').each(function(d){
      if(a.has(d?.source?.data?.id)&&a.has(d?.target?.data?.id))
        d3.select(this).classed('ln',true);
    });
    return a;
  }

  function clearLineage() {
    d3.selectAll('.ng.lin, .ng.ln, .ng.hl-lin').classed('lin',false).classed('ln',false).classed('lin',false);
    d3.selectAll('.br.lin, .br.ln, .br.hl-lin').classed('lin',false).classed('ln',false).classed('lin',false);
  }

  function getMember(id) { return _map[id]; }
  function getMembers()  { return _members; }

  return { render,centreOnNode,centreOnRoot,highlight,highlightLineage,clearLineage,getMember,getMembers };
})();

/**
 * ui.js — واجهة المستخدم الكاملة
 */
const UI = (() => {

  let _cur=null, _auth=false;
  const _proc=new Set();
  const $=id=>document.getElementById(id);

  function toast(msg,ms=3200) {
    const t=$('toast'); t.textContent=msg; t.classList.add('on');
    setTimeout(()=>t.classList.remove('on'),ms);
  }

  // ── القائمة المنبثقة ──
  function _showMenu(id,x,y) {
    _cur=id;
    const m=$('ctxMenu');
    const vw=window.innerWidth, vh=window.innerHeight;
    const mw=210, mh=_auth?260:220;

    // إظهار/إخفاء زر المسح حسب حالة الأدمن
    const delBtn = $('ctxDelete');
    if (delBtn) delBtn.style.display = _auth ? '' : 'none';

    m.style.left=Math.max(4,Math.min(x-mw/2,vw-mw-4))+'px';
    m.style.top =Math.min(y+10,vh-mh-4)+'px';
    m.classList.add('on');
  }
  function _hideMenu() { $('ctxMenu').classList.remove('on'); _cur=null; }

  function onNodeClick(id,x,y) {
    if($('ctxMenu').classList.contains('on')&&_cur===id){ _hideMenu(); return; }
    _hideMenu(); _showMenu(id,x,y);
  }

  // ── لوحة التفاصيل ──
  function _openDetail(id) {
    const m=Tree.getMember(id); if(!m) return;
    const yr=m.birth_date?String(m.birth_date).replace(/-.*/, ''):'';
    const rows=[
      ['📅','سنة الميلاد',yr],
      ['📞','الهاتف',m.phone],
      ['🏠','العنوان',m.address],
      ['💼','المهنة',m.job],
      ['📝','ملاحظة',m.note],
    ].filter(r=>r[2]);

    $('detailBody').innerHTML=`
      <div class="d-avatar">👤</div>
      <div class="d-name">${m.name}</div>
      ${rows.map(r=>`<div class="d-row">
        <span class="d-icon">${r[0]}</span>
        <div><div class="d-lbl">${r[1]}</div><div class="d-val">${r[2]}</div></div>
      </div>`).join('')||'<p class="d-empty">لا توجد تفاصيل بعد.</p>'}
    `;
    $('detailPanel').classList.add('open');
    $('panelOverlay').classList.add('on');
  }
  function _closeDetail() {
    $('detailPanel').classList.remove('open');
    $('panelOverlay').classList.remove('on');
  }

  // ── نافذة النموذج ──
  function _openModal(html) { $('modalBody').innerHTML=html; $('modalBack').classList.add('on'); }
  function _closeModal()    { $('modalBack').classList.remove('on'); }

  // ── إضافة ابن ──
  function _formChild(pid) {
    const p=Tree.getMember(pid), ia=_auth;
    const lbl=ia?'✅ إضافة مباشرة':'إرسال الطلب';
    _openModal(`
      <div class="modal-title">👶 إضافة ابن </div>
      ${ia?'<div class="admin-badge">🔑 وضع المدير — فوري</div>':''}
      <p class="p-info">إضافة إلى: <strong>${p?.name||pid}</strong></p>
      <div class="form-group">
        <label class="form-label">الاسم <span class="req">*</span></label>
        <input class="form-input" id="fn" type="text" placeholder="أدخل الاسم" maxlength="30"/>
        <small class="form-hint">اسم واحد فقط</small>
      </div>
      <div class="form-group">
        <label class="form-label">سنة الميلاد</label>
        <input class="form-input" id="fb" type="number" placeholder="مثال: 1995" min="1900" max="2025" style="width:130px"/>
      </div>
      ${!ia?`<div class="form-group"><label class="form-label">اسمك (اختياري)</label>
        <input class="form-input" id="fby" type="text" placeholder="من قدّم الطلب؟"/></div>`:''}
      <button class="btn-gold" id="fsub">${lbl}</button>
      <p class="success-msg" id="fmsg"></p>
    `);
    $('fsub').onclick=async()=>{
      const name=$('fn').value.trim();
      if(!name){ toast('⚠️ الاسم مطلوب'); return; }
      if(/\s/.test(name)){ toast('⚠️ اسم واحد فقط'); return; }
      const btn=$('fsub'); btn.textContent='جاري…'; btn.disabled=true;
      try {
        if(ia){
          await Sheets.directAddChild({parentId:pid,childName:name,birthYear:$('fb').value});
          $('fmsg').textContent='✅ تمت الإضافة!';
          btn.style.display='none';
          setTimeout(()=>{ _closeModal(); App.reload(); },900);
        } else {
          await Sheets.submitAddChild({parentId:pid,childName:name,birthYear:$('fb').value,submittedBy:$('fby')?.value});
          $('fmsg').textContent='✅ تم الإرسال! سيظهر بعد الموافقة.';
          btn.style.display='none';
        }
      } catch(e){ toast('❌ '+e.message); btn.textContent=lbl; btn.disabled=false; }
    };
  }

  // ── تعديل البيانات ──
  function _formEdit(mid) {
    const m=Tree.getMember(mid)||{}, ia=_auth;
    const lbl=ia?'✅ حفظ مباشر':'إرسال التحديث';
    const yr=m.birth_date?String(m.birth_date).replace(/-.*/, ''):'';
    _openModal(`
      <div class="modal-title">✏️ تعديل البيانات</div>
      ${ia?'<div class="admin-badge">🔑 وضع المدير — فوري</div>':''}
      <p class="p-info">تعديل: <strong>${m.name||mid}</strong></p>
      ${ia?`<div class="form-group"><label class="form-label">الاسم <span class="req">*</span></label>
        <input class="form-input" id="enm" value="${m.name||''}"/></div>`:''}
      <div class="form-group"><label class="form-label">سنة الميلاد</label>
        <input class="form-input" id="eb" type="number" value="${yr}" placeholder="1985" min="1900" max="2025" style="width:130px"/></div>
      <div class="form-group"><label class="form-label">الهاتف</label>
        <input class="form-input" id="eph" type="tel" value="${m.phone||''}" placeholder="07XX XXX XXXX"/></div>
      <div class="form-group"><label class="form-label">العنوان</label>
        <input class="form-input" id="ead" value="${m.address||''}" placeholder="المدينة…"/></div>
      <div class="form-group"><label class="form-label">المهنة</label>
        <input class="form-input" id="ej" value="${m.job||''}" placeholder="مهندس، طبيب…"/></div>
      <div class="form-group"><label class="form-label">ملاحظة</label>
        <textarea class="form-textarea" id="eno">${m.note||''}</textarea></div>
      ${!ia?`<div class="form-group"><label class="form-label">اسمك (اختياري)</label>
        <input class="form-input" id="eby" placeholder="من قدّم الطلب؟"/></div>`:''}
      <button class="btn-gold" id="esub">${lbl}</button>
      <p class="success-msg" id="emsg"></p>
    `);
    $('esub').onclick=async()=>{
      const btn=$('esub'); btn.textContent='جاري…'; btn.disabled=true;
      try {
        if(ia){
          const nm=$('enm')?.value.trim();
          if(!nm){ toast('⚠️ الاسم مطلوب'); btn.textContent=lbl; btn.disabled=false; return; }
          await Sheets.directUpdate({memberId:mid,name:nm,birthDate:$('eb').value,phone:$('eph').value,address:$('ead').value,job:$('ej').value,note:$('eno').value});
          $('emsg').textContent='✅ تم الحفظ!';
          btn.style.display='none';
          setTimeout(()=>{ _closeModal(); App.reload(); },900);
        } else {
          await Sheets.submitUpdateDetails({memberId:mid,memberName:m.name,birthDate:$('eb').value,phone:$('eph').value,address:$('ead').value,job:$('ej').value,note:$('eno').value,submittedBy:$('eby')?.value});
          $('emsg').textContent='✅ تم الإرسال! سيظهر بعد الموافقة.';
          btn.style.display='none';
        }
      } catch(e){ toast('❌ '+e.message); btn.textContent=lbl; btn.disabled=false; }
    };
  }

  // ── إظهار الأصل ──
  function _formLineage(id) {
    Tree.highlightLineage(id);
    const chain=[]; let c=id;
    while(c){ const m=Tree.getMember(c); if(!m) break; chain.unshift(m.name); c=m.parent_id&&Tree.getMember(m.parent_id)?m.parent_id:null; }
    const mem=Tree.getMember(id);
    _openModal(`
      <div class="modal-title">🔗 سلسلة الأصل</div>
      <p class="p-info">سلالة: <strong>${mem?.name||id}</strong></p>
      <div class="lineage-chain">
        ${chain.map((n,i)=>`
          <div class="lin-step ${i===chain.length-1?'current':''}">
            <span class="lin-num">${i+1}</span>
            <span class="lin-name">${n}</span>
          </div>
          ${i<chain.length-1?'<div class="lin-arrow">↓</div>':''}`).join('')}
      </div>
      <button class="btn-outline" id="clrL">✕ إخفاء التمييز</button>
    `);
    $('clrL').onclick=()=>{ Tree.clearLineage(); _closeModal(); };
  }

  // ── حذف عضو (أدمن فقط) ──
  function _formDelete(id) {
    const m = Tree.getMember(id);
    if (!m) return;
    _openModal(`
      <div class="modal-title">🗑️ حذف عضو</div>
      <p class="p-info" style="margin-bottom:18px">
        هل أنت متأكد من حذف:<br/>
        <strong style="color:var(--brown);font-size:1rem">${m.name}</strong>؟<br/>
        <span style="color:var(--danger);font-size:.8rem">⚠️ لا يمكن التراجع عن هذا الإجراء</span>
      </p>
      <button class="btn-gold" id="dconf" style="background:var(--danger)">✓ تأكيد الحذف</button>
      <button class="btn-outline" id="dcanc" style="margin-top:8px">إلغاء</button>
    `);
    $('dcanc').onclick = _closeModal;
    $('dconf').onclick = async () => {
      const btn = $('dconf');
      btn.textContent = 'جاري الحذف…'; btn.disabled = true;
      try {
        await Sheets.deleteMember(id);
        toast('✅ تم حذف العضو');
        _closeModal();
        App.reload();
      } catch(e) {
        toast('❌ ' + e.message);
        btn.textContent = 'تأكيد الحذف'; btn.disabled = false;
      }
    };
  }

  // ── الإحصائيات ──
  function _showStats() {
    const ms=Tree.getMembers(), total=ms.length;
    const freq={};
    ms.forEach(m=>{ const w=(m.name||'').split(' ')[0]; if(w) freq[w]=(freq[w]||0)+1; });
    const top3=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3);
    _openModal(`
      <div class="modal-title">📊 إحصائيات الشجرة</div>
      <div class="stats-total"><div class="stats-num">${total}</div><div class="stats-lbl">فرد في الشجرة</div></div>
      <p class="p-info" style="margin-bottom:8px">أكثر الأسماء تكراراً</p>
      ${top3.map(([n,c],i)=>`<div class="stats-row">
        <span class="stats-rank">${['🥇','🥈','🥉'][i]}</span>
        <span class="stats-name">${n}</span>
        <span class="stats-count">${c} مرة</span>
      </div>`).join('')}
      <div class="stats-credit">
        تم إنشاء هذا البرنامج من قبل<br/>
        <strong>فضل عباس زينل</strong><br/>
        <a href="tel:07501377753" class="stats-phone">📞 07501377753</a>
      </div>
    `);
  }

  // ── البحث ──
  function _norm(s) {
    return (s||'').toLowerCase().trim()
      .replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');
  }
  function _score(m,parts) {
    const n=_norm(m.name),ws=n.split(' ');
    let s=0;
    parts.forEach(p=>{ if(n===p) s+=100; else if(n.startsWith(p)) s+=60; else if(n.includes(p)) s+=30;
      ws.forEach(w=>{ if(w===p) s+=20; else if(w.startsWith(p)) s+=10; }); });
    return s;
  }
  function _doSearch() {
    const raw=$('searchInput').value.trim();
    if(!raw){ _hideDrop(); return; }
    const parts=_norm(raw).split(/\s+/).filter(Boolean);
    const scored=Tree.getMembers()
      .map(m=>({m,s:_score(m,parts)})).filter(x=>x.s>0)
      .sort((a,b)=>b.s-a.s).slice(0,20);
    if(!scored.length){ _showDrop([{label:'لا توجد نتائج',id:null}]); return; }
    if(scored.length===1){ _selectM(scored[0].m.id); _hideDrop(); return; }
    _showDrop(scored.map(x=>({
      label:x.m.name,
      sub:[x.m.birth_date?String(x.m.birth_date).replace(/-.*/, ''):'',x.m.job].filter(Boolean).join(' · '),
      id:x.m.id
    })));
  }
  function _showDrop(items) {
    const d=$('searchDrop');
    d.innerHTML=items.map(it=>`<div class="s-item" data-id="${it.id||''}">
      <div>${it.label}</div>${it.sub?`<div class="s-sub">${it.sub}</div>`:''}
    </div>`).join('');
    d.querySelectorAll('[data-id]').forEach(row=>{
      row.addEventListener('click',()=>{
        if(row.dataset.id) _selectM(row.dataset.id);
        _hideDrop();
        $('searchInput').value=row.querySelector('div').textContent;
      });
    });
    d.classList.add('open');
  }
  function _hideDrop() { $('searchDrop').classList.remove('open'); }
  function _selectM(id) { Tree.centreOnNode(id); Tree.highlight(id); }

  // ── الإدارة ──
  function _openAdmin()  { $('adminBack').classList.add('on'); }
  function _closeAdmin() { $('adminBack').classList.remove('on'); }
  function _adminLogin() {
    if($('adminPw').value===CONFIG.ADMIN_PASSWORD){
      _auth=true;
      $('adminLogin').style.display='none';
      $('adminContent').style.display='';
      _loadAdmin(); toast('✅ مرحباً يا مدير');
    } else { toast('❌ كلمة المرور غير صحيحة'); }
  }
  async function _loadAdmin() {
    $('atChildren').innerHTML='<p class="empty-state">جاري التحميل…</p>';
    $('atUpdates').innerHTML ='<p class="empty-state">جاري التحميل…</p>';
    try {
      const [reqs,upds]=await Promise.all([Sheets.getPendingReqs(),Sheets.getPendingUpds()]);
      _renderReqs(reqs.filter(r=>r.status==='pending'));
      _renderUpds(upds.filter(r=>r.status==='pending'));
    } catch(e){ $('atChildren').innerHTML=`<p class="empty-state">خطأ: ${e.message}</p>`; }
  }
  function _renderReqs(list) {
    if(!list.length){ $('atChildren').innerHTML='<p class="empty-state">لا توجد طلبات.</p>'; return; }
    $('atChildren').innerHTML=list.map(r=>{
      const p=Tree.getMember(r.parent_id);
      return `<div class="req-card" id="rc_${r.request_id}">
        <div class="req-title">إضافة: <strong>${r.child_name}</strong></div>
        <div class="req-meta">الأب: ${p?p.name:r.parent_id}<br/>سنة: ${r.birth_date||'—'}<br/>مقدّم: ${r.submitted_by||'—'}</div>
        <div class="req-btns">
          <button class="btn-ok" onclick="UI.approveChild('${r.request_id}')">✓ موافقة</button>
          <button class="btn-no" onclick="UI.rejectChild('${r.request_id}')">✕ رفض</button>
        </div>
      </div>`;
    }).join('');
  }
  function _renderUpds(list) {
    if(!list.length){ $('atUpdates').innerHTML='<p class="empty-state">لا توجد طلبات.</p>'; return; }
    $('atUpdates').innerHTML=list.map(u=>`
      <div class="req-card" id="ru_${u.request_id}">
        <div class="req-title">تعديل: <strong>${u.member_name}</strong></div>
        <div class="req-meta">
          ${u.birth_date?`سنة: ${u.birth_date}<br/>`:''}
          ${u.phone?`هاتف: ${u.phone}<br/>`:''}
          ${u.address?`عنوان: ${u.address}<br/>`:''}
          ${u.job?`مهنة: ${u.job}<br/>`:''}
          مقدّم: ${u.submitted_by||'—'}
        </div>
        <div class="req-btns">
          <button class="btn-ok" onclick="UI.approveUpdate('${u.request_id}')">✓ موافقة</button>
          <button class="btn-no" onclick="UI.rejectUpdate('${u.request_id}')">✕ رفض</button>
        </div>
      </div>`).join('');
  }
  async function _proc2(id,fn,el){ // منع التكرار
    if(_proc.has(id)) return; _proc.add(id);
    const card=document.getElementById(el);
    if(card) card.querySelectorAll('button').forEach(b=>{b.disabled=true;b.style.opacity='.5';});
    try{ await fn(id); document.getElementById(el)?.remove(); toast('✅ تم'); App.reload(); }
    catch(e){ toast('❌ '+e.message);
      if(card) card.querySelectorAll('button').forEach(b=>{b.disabled=false;b.style.opacity='';});
    } finally{ _proc.delete(id); }
  }
  const approveChild  = id=>_proc2(id,Sheets.approveChild,  `rc_${id}`);
  const rejectChild   = id=>_proc2(id,i=>Sheets.rejectReq(i,'pending_requests'),`rc_${id}`);
  const approveUpdate = id=>_proc2(id,Sheets.approveUpdate, `ru_${id}`);
  const rejectUpdate  = id=>_proc2(id,Sheets.rejectUpd,     `ru_${id}`);

  // ── PWA ──
  let _dPWA=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();_dPWA=e;});
  function _pwa(){
    if(localStorage.getItem('pwa_ok')) return;
    const sc=document.getElementById('installScreen');
    sc.style.display='flex';
    document.getElementById('installBtn').onclick=async()=>{
      if(_dPWA){ _dPWA.prompt(); const{outcome}=await _dPWA.userChoice; _dPWA=null;
        if(outcome==='accepted'){ localStorage.setItem('pwa_ok','1'); sc.style.display='none'; }
        else document.getElementById('installNote').textContent='يمكنك التثبيت لاحقاً من قائمة المتصفح';
      } else {
        document.getElementById('installNote').innerHTML='<strong>iPhone:</strong> اضغط ⬆️ ثم «إضافة إلى الشاشة الرئيسية»';
      }
    };
    document.getElementById('installSkip').onclick=()=>{localStorage.setItem('pwa_ok','1');sc.style.display='none';};
  }

  // ── التهيئة ──
  function init() {
    _pwa();
    $('closeDetail').onclick  =$('panelOverlay').onclick=_closeDetail;
    $('closeModal').onclick   =_closeModal;
    $('modalBack').addEventListener('click',e=>{if(e.target===$('modalBack'))_closeModal();});
    $('ctxView').onclick    =()=>{ const id=_cur;_hideMenu(); if(id) _openDetail(id); };
    $('ctxChild').onclick   =()=>{ const id=_cur;_hideMenu(); if(id) _formChild(id); };
    $('ctxEdit').onclick    =()=>{ const id=_cur;_hideMenu(); if(id) _formEdit(id); };
    $('ctxLineage').onclick =()=>{ const id=_cur;_hideMenu(); if(id) _formLineage(id); };
    if ($('ctxDelete'))
      $('ctxDelete').onclick=()=>{ const id=_cur;_hideMenu(); if(id) _formDelete(id); };
    document.addEventListener('click',   e=>{ if(!e.target.closest('#ctxMenu')&&!e.target.closest('.nh')) _hideMenu(); });
    document.addEventListener('touchstart',e=>{ if(!e.target.closest('#ctxMenu')&&!e.target.closest('.nh')) _hideMenu(); },{passive:true});
    $('btnAdmin').onclick    =_openAdmin;
    $('closeAdmin').onclick  =_closeAdmin;
    $('adminLoginBtn').onclick=_adminLogin;
    $('adminBack').addEventListener('click',e=>{if(e.target===$('adminBack'))_closeAdmin();});
    $('adminPw').addEventListener('keydown',e=>{if(e.key==='Enter')_adminLogin();});
    document.querySelectorAll('.atab').forEach(btn=>{ btn.addEventListener('click',()=>{
      document.querySelectorAll('.atab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      $('atChildren').style.display=btn.dataset.tab==='children'?'':'none';
      $('atUpdates').style.display =btn.dataset.tab==='updates' ?'':'none';
    });});
    let tmr;
    $('searchInput').addEventListener('input',()=>{ clearTimeout(tmr); tmr=setTimeout(_doSearch,260); });
    $('searchInput').addEventListener('keydown',e=>{ if(e.key==='Enter'){clearTimeout(tmr);_doSearch();} if(e.key==='Escape')_hideDrop(); });
    $('searchBtn').addEventListener('click',_doSearch);
    document.addEventListener('mousedown',e=>{ if(!e.target.closest('.search-wrap')) _hideDrop(); });
    $('btnRefresh').onclick=async()=>{
      $('btnRefresh').textContent='⏳'; $('btnRefresh').disabled=true;
      await App.reload();
      $('btnRefresh').textContent='🔄 تحديث'; $('btnRefresh').disabled=false;
    };
    $('btnStats').onclick =$('btnStats').onclick=_showStats;
    $('btnCenter').onclick=()=>Tree.centreOnRoot();
  }

  // دالة عامة يستدعيها tree.js عند الضغط المطوّل
  function showMenu(id,x,y){ _hideMenu(); _showMenu(id,x,y); }

  return { init, onNodeClick, showMenu, toast, approveChild, rejectChild, approveUpdate, rejectUpdate };
})();

/**
 * app.js
 */
const App = (() => {
  const KEY='shaj_v5';
  const save=m=>{ try{localStorage.setItem(KEY,JSON.stringify(m));}catch(e){} };
  const load=()=>{ try{const d=localStorage.getItem(KEY);return d?JSON.parse(d):null;}catch(e){return null;} };

  function _hide() {
    const el=document.getElementById('loader');
    el.classList.add('out');
    setTimeout(()=>el.remove(),600);
  }

  async function _fetch() {
    try {
      const ms=await Sheets.getMembers();
      if(ms.length){ save(ms); Tree.render(ms); return true; }
    } catch(e){ console.warn(e.message); }
    return false;
  }

  async function load2() {
    // انتظر حتى تكون الـ DOM جاهزة تماماً
    await new Promise(r => requestAnimationFrame(r));

    const cached=load();
    if(cached&&cached.length){
      Tree.render(cached); _hide();
      _fetch().then(ok=>{ if(ok) UI.toast('🔄 تم تحديث البيانات'); });
    } else {
      document.getElementById('loaderMsg').textContent='جاري التحميل من الشبكة…';
      const ok=await _fetch();
      if(!ok) {
        document.getElementById('loaderMsg').textContent='⚠️ تعذّر الاتصال — تحقق من رابط Apps Script';
        setTimeout(_hide,3000);
      } else { _hide(); }
    }
  }

  async function reload() {
    const ok=await _fetch();
    if(!ok) UI.toast('⚠️ تعذّر التحديث');
  }

  function init() {
    UI.init();
    load2();
    if('serviceWorker' in navigator)
      window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
  }

  document.addEventListener('DOMContentLoaded',init);
  return { reload };
})();
