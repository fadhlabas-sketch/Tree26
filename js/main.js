/**
 * config.js
 */
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw7L_lcPeNqnhdV4pdConYjf2p7RSiuTJ89EIOqnc2VX9MPYyeEdVLkJ1A5RwXvYlE/exec',
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


  // بناء الاسم الثلاثي: اسم الشخص + اسم أبيه + اسم جده
  function _fullName(id) {
    const parts = [];
    let cur = id;
    for (let i = 0; i < 3; i++) {
      const m = _map[cur];
      if (!m || !m.name) break;
      parts.push(m.name);
      cur = m.parent_id && _map[m.parent_id] ? m.parent_id : null;
      if (!cur) break;
    }
    return parts.join(' ');
  }

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

  return { render,centreOnNode,centreOnRoot,highlight,highlightLineage,clearLineage,getMember,getMembers,_fullName };
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
      <div class="modal-title">👶 إضافة ابن / ابنة</div>
      ${ia?'<div class="admin-badge">🔑 وضع المدير — فوري</div>':''}
      <p class="p-info">إضافة إلى: <strong>${_fullName(pid)}</strong></p>
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
          if(!nm){ toast('⚠️ الاسم مطل