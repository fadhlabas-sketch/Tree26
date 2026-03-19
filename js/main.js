/**
 * config.js — الإعدادات
 * ⚠️ عدّل هذه القيم قبل الرفع
 */
const CONFIG = {
  // رابط Apps Script بعد النشر
  APPS_SCRIPT_URL: 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE',

  // كلمة مرور المدير
  ADMIN_PASSWORD: 'admin123',

  // مدة الضغط للقائمة المنبثقة (ms) — 0 = نقرة واحدة فقط
  LONG_PRESS: 0,
};
/**
 * sheets.js — التواصل مع Google Sheets
 */
const Sheets = (() => {

  async function _call(params) {
    const url = CONFIG.APPS_SCRIPT_URL;
    if (!url || url.includes('YOUR_APPS_SCRIPT')) {
      throw new Error('لم يتم تعيين رابط Apps Script في config.js');
    }
    let res;
    try {
      res = await fetch(`${url}?${new URLSearchParams(params)}`, { redirect: 'follow' });
    } catch (e) {
      throw new Error('تعذّر الاتصال — تحقق من الإنترنت');
    }
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  }

  const getMembers       = ()  => _call({ action: 'getMembers' }).then(d => d.members || []);
  const getPendingReqs   = ()  => _call({ action: 'getPendingRequests' }).then(d => d.requests || []);
  const getPendingUpds   = ()  => _call({ action: 'getPendingUpdates'  }).then(d => d.updates  || []);
  const approveChild     = id  => _call({ action: 'approveAddChild',    requestId: id });
  const approveUpdate    = id  => _call({ action: 'approveUpdate',      requestId: id });
  const rejectReq        = (id,sh) => _call({ action: 'rejectRequest',  requestId: id, sheet: sh });
  const rejectUpd        = id  => _call({ action: 'rejectUpdate',       requestId: id });
  const directAddChild   = p   => _call({ action: 'directAddChild',     ...p });
  const directUpdate     = p   => _call({ action: 'directUpdateMember', ...p });

  const submitAddChild = ({ parentId, childName, birthYear, submittedBy }) =>
    _call({ action: 'addPendingRequest', type: 'add_child', parentId, childName, birthDate: birthYear || '', submittedBy: submittedBy || 'مجهول' });

  const submitUpdateDetails = ({ memberId, memberName, birthDate, phone, address, job, note, submittedBy }) =>
    _call({ action: 'addPendingUpdate', memberId, memberName, birthDate: birthDate||'', phone: phone||'', address: address||'', job: job||'', note: note||'', submittedBy: submittedBy||'مجهول' });

  return { getMembers, getPendingReqs, getPendingUpds, approveChild, approveUpdate, rejectReq, rejectUpd, directAddChild, directUpdate, submitAddChild, submitUpdateDetails };
})();
/**
 * tree.js — محرك الشجرة الرادیالیة (D3.js)
 * ============================================
 * الجذر في المنتصف، الفروع تمتد في كل الاتجاهات
 */
const Tree = (() => {

  let _members = [], _map = {}, _svg = null, _g = null, _zoom = null, _initT = null;

  // ── بناء الخريطة ──────────────────────────────────────────────────────────
  function _buildMap(members) {
    _map = {};
    members.forEach(m => (_map[m.id] = m));
  }

  // ── تحويل المصفوفة إلى هرمي ───────────────────────────────────────────────
  function _toHierarchy(members) {
    const roots = members.filter(m => !m.parent_id || !_map[m.parent_id]);
    if (!roots.length) return null;

    const nodes = {};
    members.forEach(m => (nodes[m.id] = { ...m, children: [] }));
    members.forEach(m => {
      if (m.parent_id && nodes[m.parent_id]) nodes[m.parent_id].children.push(nodes[m.id]);
    });
    // إذا أكثر من جذر، أنشئ جذراً وهمياً
    if (roots.length === 1) return nodes[roots[0].id];
    return { id: '__root__', name: '', children: roots.map(r => nodes[r.id]) };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  الرسم الرئيسي
  // ══════════════════════════════════════════════════════════════════════════
  function render(members) {
    _members = members;
    _buildMap(members);

    const wrap = document.getElementById('treeWrap');
    wrap.innerHTML = '';

    const W = wrap.clientWidth  || window.innerWidth;
    const H = wrap.clientHeight || (window.innerHeight - 100);

    // ── إنشاء SVG ──
    _svg = d3.select('#treeWrap').append('svg')
      .attr('width', W).attr('height', H);

    // ── تعاريف التدرج والظلال ──
    const defs = _svg.append('defs');

    // تدرج خشبي للعقد
    const rg = defs.append('radialGradient').attr('id', 'woodGrad')
      .attr('cx', '38%').attr('cy', '32%').attr('r', '68%');
    rg.append('stop').attr('offset', '0%')   .attr('stop-color', '#e0c090');
    rg.append('stop').attr('offset', '35%')  .attr('stop-color', '#b07838');
    rg.append('stop').attr('offset', '72%')  .attr('stop-color', '#7a4c18');
    rg.append('stop').attr('offset', '100%') .attr('stop-color', '#4a2800');

    // ظل
    const fl = defs.append('filter').attr('id', 'drop')
      .attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%');
    fl.append('feDropShadow').attr('dx', 0).attr('dy', 2).attr('stdDeviation', 3).attr('flood-color', 'rgba(0,0,0,.25)');

    // ── مجموعة رئيسية ──
    _g = _svg.append('g').attr('class', 'tree-root');

    // ── بناء الهرم ──
    const hierData = _toHierarchy(members);
    if (!hierData) return;

    const root = d3.hierarchy(hierData, d => d.children && d.children.length ? d.children : null);
    const count = root.descendants().length;

    // النصف قطر: يكبر مع عدد الأعضاء
    const minDim  = Math.min(W, H);
    const radius  = Math.max(minDim * 0.44, Math.sqrt(count) * 28);

    // تخطيط رادیالي
    d3.tree()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.4) / Math.max(1, a.depth))(root);

    // ── رسم الأغصان ──
    _g.append('g').attr('class', 'branches')
      .selectAll('path')
      .data(root.links().filter(d => d.source.data.id !== '__root__'))
      .enter().append('path')
      .attr('class', 'branch')
      .attr('data-parent', d => d.source.data.id)
      .attr('data-child',  d => d.target.data.id)
      .attr('stroke-width', d => Math.max(1.2, 4.5 - d.source.depth * 0.8))
      .attr('d', d3.linkRadial().angle(d => d.x).radius(d => d.y));

    // ── رسم العقد ──
    const OW = 66, OH = 27;
    const ng = _g.append('g').attr('class', 'nodes')
      .selectAll('g.node-g')
      .data(root.descendants().filter(d => d.data.id !== '__root__'))
      .enter().append('g')
      .attr('class', 'node-g')
      .attr('data-id', d => d.data.id)
      .attr('transform', d => {
        const x = d.y * Math.cos(d.x - Math.PI / 2);
        const y = d.y * Math.sin(d.x - Math.PI / 2);
        return `translate(${x},${y})`;
      });

    ng.append('ellipse').attr('class', 'node-oval')
      .attr('rx', OW / 2).attr('ry', OH / 2)
      .style('filter', 'url(#drop)');

    ng.append('text').attr('class', 'node-label')
      .attr('dy', '.35em')
      .text(d => d.data.name || '');

    // منطقة نقر موسّعة
    ng.append('ellipse').attr('class', 'node-hit')
      .attr('rx', OW / 2 + 6).attr('ry', OH / 2 + 6)
      .on('click',    function(e, d) { e.stopPropagation(); UI.onNodeClick(d.data.id, e.clientX, e.clientY); })
      .on('touchend', function(e, d) { e.preventDefault(); e.stopPropagation();
        const t = e.changedTouches[0];
        UI.onNodeClick(d.data.id, t.clientX, t.clientY);
      });

    // ── ضبط العرض التلقائي ──
    _autoFit(W, H, root);

    // ── تفعيل zoom/pan ──
    _zoom = d3.zoom().scaleExtent([0.05, 6])
      .on('zoom', e => _g.attr('transform', e.transform));
    _svg.call(_zoom).on('dblclick.zoom', null);
    if (_initT) _svg.call(_zoom.transform, _initT);
  }

  // ── توسيط وملء الشاشة ────────────────────────────────────────────────────
  function _autoFit(W, H, root) {
    // حساب حدود الشجرة
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    root.descendants().forEach(d => {
      if (d.data.id === '__root__') return;
      const px = d.y * Math.cos(d.x - Math.PI / 2);
      const py = d.y * Math.sin(d.x - Math.PI / 2);
      if (px < x0) x0 = px; if (px > x1) x1 = px;
      if (py < y0) y0 = py; if (py > y1) y1 = py;
    });

    const pad   = 50;
    const treeW = x1 - x0 + pad * 2;
    const treeH = y1 - y0 + pad * 2;
    const scale = Math.min((W - 16) / treeW, (H - 16) / treeH, 1.8);

    const tx = W / 2 - ((x0 + x1) / 2) * scale;
    const ty = H / 2 - ((y0 + y1) / 2) * scale;

    _initT = d3.zoomIdentity.translate(tx, ty).scale(scale);
    if (_svg && _zoom) _svg.call(_zoom.transform, _initT);
  }

  // ── تمركز على عقدة ───────────────────────────────────────────────────────
  function centreOnNode(id) {
    if (!_svg || !_zoom) return;
    const el = document.querySelector(`g.node-g[data-id="${id}"]`);
    if (!el) return;
    const W = document.getElementById('treeWrap').clientWidth;
    const H = document.getElementById('treeWrap').clientHeight;
    const m = el.getScreenCTM();
    if (!m) return;
    const cx = m.e, cy = m.f;
    const cur = d3.zoomTransform(_svg.node());
    _svg.transition().duration(500)
      .call(_zoom.transform,
        d3.zoomIdentity
          .translate(cur.x + W / 2 - cx, cur.y + H / 2 - cy)
          .scale(cur.k)
      );
  }

  function centreOnRoot() {
    if (_svg && _zoom && _initT)
      _svg.transition().duration(400).call(_zoom.transform, _initT);
  }

  // ── تمييز ─────────────────────────────────────────────────────────────────
  function highlight(id) {
    d3.selectAll('g.node-g').classed('highlighted', false);
    d3.select(`g.node-g[data-id="${id}"]`).classed('highlighted', true);
  }

  function highlightLineage(id) {
    clearLineage();
    const ancs = new Set();
    let cur = id;
    while (cur) {
      ancs.add(cur);
      const m = _map[cur];
      cur = m?.parent_id && _map[m.parent_id] ? m.parent_id : null;
    }
    ancs.forEach(a => d3.select(`g.node-g[data-id="${a}"]`).classed('lineage', true));
    d3.selectAll('path.branch').each(function(d) {
      if (ancs.has(d?.source?.data?.id) && ancs.has(d?.target?.data?.id))
        d3.select(this).classed('lineage', true);
    });
    return ancs;
  }

  function clearLineage() {
    d3.selectAll('.node-g.lineage').classed('lineage', false);
    d3.selectAll('.branch.lineage').classed('lineage', false);
  }

  function getMember(id) { return _map[id]; }
  function getMembers()  { return _members; }

  return { render, centreOnNode, centreOnRoot, highlight, highlightLineage, clearLineage, getMember, getMembers };
})();
/**
 * ui.js — كل التفاعلات والنوافذ
 */
const UI = (() => {

  let _curId = null;
  let _adminAuth = false;
  const _proc = new Set();

  const $ = id => document.getElementById(id);

  // ── إشعار ─────────────────────────────────────────────────────────────────
  function toast(msg, ms = 3200) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    setTimeout(() => t.classList.remove('on'), ms);
  }

  // ── قائمة منبثقة ──────────────────────────────────────────────────────────
  function _showMenu(id, x, y) {
    _curId = id;
    const m  = $('ctxMenu');
    const vw = window.innerWidth, vh = window.innerHeight;
    const mw = 200, mh = 210;
    m.style.left = Math.min(x - mw / 2, vw - mw - 6) + 'px';
    m.style.top  = Math.min(y + 10, vh - mh - 6) + 'px';
    m.classList.add('on');
  }

  function _hideMenu() { $('ctxMenu').classList.remove('on'); _curId = null; }

  function onNodeClick(id, x, y) {
    if ($('ctxMenu').classList.contains('on') && _curId === id) { _hideMenu(); return; }
    _hideMenu();
    _showMenu(id, x, y);
  }

  // ── لوحة التفاصيل ─────────────────────────────────────────────────────────
  function _openDetail(id) {
    const m = Tree.getMember(id);
    if (!m) return;

    const rows = [
      ['📅', 'تاريخ الميلاد', m.birth_date ? String(m.birth_date).replace(/-.*/, '') : ''],
      ['📞', 'الهاتف',       m.phone   ],
      ['🏠', 'العنوان',      m.address ],
      ['💼', 'المهنة',       m.job     ],
      ['📝', 'ملاحظة',      m.note    ],
    ].filter(r => r[2]);

    $('detailBody').innerHTML = `
      <div class="d-avatar">👤</div>
      <div class="d-name">${m.name}</div>
      ${rows.map(r => `
        <div class="d-row">
          <span class="d-icon">${r[0]}</span>
          <div><div class="d-lbl">${r[1]}</div><div class="d-val">${r[2]}</div></div>
        </div>`).join('') || '<p class="d-empty">لا توجد تفاصيل بعد.<br/>اضغط على الاسم ثم «تعديل البيانات».</p>'}
    `;
    $('detailPanel').classList.add('open');
    $('panelOverlay').classList.add('on');
  }

  function _closeDetail() {
    $('detailPanel').classList.remove('open');
    $('panelOverlay').classList.remove('on');
  }

  // ── نافذة نموذج ───────────────────────────────────────────────────────────
  function _openModal(html) {
    $('modalBody').innerHTML = html;
    $('modalBack').classList.add('on');
  }
  function _closeModal() { $('modalBack').classList.remove('on'); }

  // ── نموذج إضافة ابن ───────────────────────────────────────────────────────
  function _formAddChild(parentId) {
    const p      = Tree.getMember(parentId);
    const isAdm  = _adminAuth;
    const lbl    = isAdm ? '✅ إضافة مباشرة' : 'إرسال الطلب';
    _openModal(`
      <div class="modal-title">👶 إضافة ابن / ابنة</div>
      ${isAdm ? '<div class="admin-badge">🔑 وضع المدير — الإضافة فورية</div>' : ''}
      <p class="p-info">إضافة إلى: <strong>${p?.name || parentId}</strong></p>
      <div class="form-group">
        <label class="form-label">الاسم <span class="req">*</span></label>
        <input class="form-input" id="fc_n" type="text" placeholder="مثال: محمد" maxlength="30"/>
        <small class="form-hint">مقطع واحد فقط بدون لقب</small>
      </div>
      <div class="form-group">
        <label class="form-label">سنة الميلاد</label>
        <input class="form-input" id="fc_b" type="number" placeholder="مثال: 1995" min="1900" max="2025" style="width:140px"/>
      </div>
      ${!isAdm ? `<div class="form-group"><label class="form-label">اسمك (اختياري)</label>
        <input class="form-input" id="fc_by" type="text" placeholder="من قدّم الطلب؟"/></div>` : ''}
      <button class="btn-gold" id="fc_sub">${lbl}</button>
      <p class="success-msg" id="fc_msg"></p>
    `);

    $('fc_sub').onclick = async () => {
      const name = $('fc_n').value.trim();
      if (!name)         { toast('⚠️ الاسم مطلوب'); return; }
      if (/\s/.test(name)) { toast('⚠️ مقطع واحد فقط — بدون مسافة'); return; }
      const btn = $('fc_sub');
      btn.textContent = 'جاري…'; btn.disabled = true;
      try {
        if (isAdm) {
          await Sheets.directAddChild({ parentId, childName: name, birthYear: $('fc_b').value });
          $('fc_msg').textContent = '✅ تمت الإضافة فوراً!';
          btn.style.display = 'none';
          setTimeout(() => { _closeModal(); App.reload(); }, 900);
        } else {
          await Sheets.submitAddChild({ parentId, childName: name, birthYear: $('fc_b').value, submittedBy: $('fc_by')?.value });
          $('fc_msg').textContent = '✅ تم إرسال الطلب! سيظهر بعد الموافقة.';
          btn.style.display = 'none';
        }
      } catch (e) { toast('❌ ' + e.message); btn.textContent = lbl; btn.disabled = false; }
    };
  }

  // ── نموذج تعديل البيانات ──────────────────────────────────────────────────
  function _formEditDetails(memberId) {
    const m     = Tree.getMember(memberId) || {};
    const isAdm = _adminAuth;
    const lbl   = isAdm ? '✅ حفظ مباشر' : 'إرسال التحديث';
    const yr    = m.birth_date ? String(m.birth_date).replace(/-.*/, '') : '';
    _openModal(`
      <div class="modal-title">✏️ تعديل البيانات</div>
      ${isAdm ? '<div class="admin-badge">🔑 وضع المدير — الحفظ فوري</div>' : ''}
      <p class="p-info">تعديل: <strong>${m.name || memberId}</strong></p>
      ${isAdm ? `<div class="form-group"><label class="form-label">الاسم <span class="req">*</span></label>
        <input class="form-input" id="fd_nm" type="text" value="${m.name||''}"/></div>` : ''}
      <div class="form-group"><label class="form-label">سنة الميلاد</label>
        <input class="form-input" id="fd_b" type="number" placeholder="مثال: 1985" min="1900" max="2025" style="width:140px" value="${yr}"/></div>
      <div class="form-group"><label class="form-label">الهاتف</label>
        <input class="form-input" id="fd_ph" type="tel" placeholder="07XX XXX XXXX" value="${m.phone||''}"/></div>
      <div class="form-group"><label class="form-label">العنوان</label>
        <input class="form-input" id="fd_ad" type="text" placeholder="المدينة، المحافظة" value="${m.address||''}"/></div>
      <div class="form-group"><label class="form-label">المهنة</label>
        <input class="form-input" id="fd_j" type="text" placeholder="مهندس، طبيب…" value="${m.job||''}"/></div>
      <div class="form-group"><label class="form-label">ملاحظة</label>
        <textarea class="form-textarea" id="fd_no">${m.note||''}</textarea></div>
      ${!isAdm ? `<div class="form-group"><label class="form-label">اسمك (اختياري)</label>
        <input class="form-input" id="fd_by" type="text" placeholder="من قدّم الطلب؟"/></div>` : ''}
      <button class="btn-gold" id="fd_sub">${lbl}</button>
      <p class="success-msg" id="fd_msg"></p>
    `);

    $('fd_sub').onclick = async () => {
      const btn = $('fd_sub');
      btn.textContent = 'جاري…'; btn.disabled = true;
      try {
        if (isAdm) {
          const nm = $('fd_nm')?.value.trim();
          if (!nm) { toast('⚠️ الاسم مطلوب'); btn.textContent = lbl; btn.disabled = false; return; }
          await Sheets.directUpdate({ memberId, name: nm, birthDate: $('fd_b').value, phone: $('fd_ph').value, address: $('fd_ad').value, job: $('fd_j').value, note: $('fd_no').value });
          $('fd_msg').textContent = '✅ تم الحفظ فوراً!';
          btn.style.display = 'none';
          setTimeout(() => { _closeModal(); App.reload(); }, 900);
        } else {
          await Sheets.submitUpdateDetails({ memberId, memberName: m.name, birthDate: $('fd_b').value, phone: $('fd_ph').value, address: $('fd_ad').value, job: $('fd_j').value, note: $('fd_no').value, submittedBy: $('fd_by')?.value });
          $('fd_msg').textContent = '✅ تم إرسال التحديث! سيظهر بعد الموافقة.';
          btn.style.display = 'none';
        }
      } catch (e) { toast('❌ ' + e.message); btn.textContent = lbl; btn.disabled = false; }
    };
  }

  // ── إظهار الأصل ───────────────────────────────────────────────────────────
  function _showLineage(id) {
    const ancs = Tree.highlightLineage(id);
    const chain = [];
    let cur = id;
    while (cur) {
      const m = Tree.getMember(cur);
      if (!m) break;
      chain.unshift(m.name);
      cur = m.parent_id && Tree.getMember(m.parent_id) ? m.parent_id : null;
    }
    const mem = Tree.getMember(id);
    _openModal(`
      <div class="modal-title">🔗 سلسلة الأصل</div>
      <p class="p-info">سلالة: <strong>${mem?.name||id}</strong></p>
      <div class="lineage-chain">
        ${chain.map((n, i) => `
          <div class="lin-step ${i===chain.length-1?'current':''}">
            <span class="lin-num">${i+1}</span>
            <span class="lin-name">${n}</span>
          </div>
          ${i<chain.length-1 ? '<div class="lin-arrow">↓</div>' : ''}
        `).join('')}
      </div>
      <button class="btn-outline" id="clrLin">✕ إخفاء التمييز</button>
    `);
    $('clrLin').onclick = () => { Tree.clearLineage(); _closeModal(); };
  }

  // ── الإحصائيات ────────────────────────────────────────────────────────────
  function _showStats() {
    const members = Tree.getMembers();
    const total   = members.length;
    const freq    = {};
    members.forEach(m => { const w = (m.name||'').split(/\s+/)[0]; if(w) freq[w]=(freq[w]||0)+1; });
    const top3 = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3);
    _openModal(`
      <div class="modal-title">📊 إحصائيات الشجرة</div>
      <div class="stats-total"><div class="stats-num">${total}</div><div class="stats-lbl">فرد في الشجرة</div></div>
      <p class="p-info" style="margin-bottom:8px">أكثر الأسماء تكراراً</p>
      ${top3.map(([n,c],i)=>`<div class="stats-row"><span class="stats-rank">${['🥇','🥈','🥉'][i]}</span><span class="stats-name">${n}</span><span class="stats-count">${c} مرة</span></div>`).join('')}
      <div class="stats-credit">
        تم إنشاء هذا البرنامج من قبل<br/>
        <strong>فضل عباس زينل</strong><br/>
        <a href="tel:07501377753" class="stats-phone">📞 07501377753</a>
      </div>
    `);
  }

  // ── البحث ─────────────────────────────────────────────────────────────────
  function _norm(s) {
    return (s||'').toLowerCase().trim()
      .replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }

  function _score(member, parts) {
    const n = _norm(member.name), ws = n.split(/\s+/);
    let s = 0;
    parts.forEach(p => {
      if (n===p) s+=100; else if (n.startsWith(p)) s+=60; else if (n.includes(p)) s+=30;
      ws.forEach(w => { if (w===p) s+=20; else if (w.startsWith(p)) s+=10; });
    });
    return s;
  }

  function _doSearch() {
    const raw = $('searchInput').value.trim();
    if (!raw) { _hideDrop(); return; }
    const parts   = _norm(raw).split(/\s+/).filter(Boolean);
    const members = Tree.getMembers();
    const scored  = members.map(m => ({ m, s: _score(m, parts) })).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,20);

    if (!scored.length) { _showDrop([{ label:'لا توجد نتائج', id: null }]); return; }
    if (scored.length===1) { _selectMember(scored[0].m.id); _hideDrop(); return; }
    _showDrop(scored.map(x => ({ label: x.m.name, sub: [x.m.birth_date?String(x.m.birth_date).replace(/-.*/, ''):'', x.m.job].filter(Boolean).join(' · '), id: x.m.id })));
  }

  function _showDrop(items) {
    const d = $('searchDrop');
    d.innerHTML = items.map(it=>`
      <div class="s-item" data-id="${it.id||''}">
        <div>${it.label}</div>
        ${it.sub?`<div class="s-sub">${it.sub}</div>`:''}
      </div>`).join('');
    d.querySelectorAll('[data-id]').forEach(row => {
      row.addEventListener('click', () => {
        if (row.dataset.id) _selectMember(row.dataset.id);
        _hideDrop();
        $('searchInput').value = row.querySelector('div').textContent;
      });
    });
    d.classList.add('open');
  }

  function _hideDrop() { $('searchDrop').classList.remove('open'); }
  function _selectMember(id) { Tree.centreOnNode(id); Tree.highlight(id); }

  // ── الإدارة ───────────────────────────────────────────────────────────────
  function _openAdmin()  { $('adminBack').classList.add('on'); }
  function _closeAdmin() { $('adminBack').classList.remove('on'); }

  function _adminLogin() {
    if ($('adminPw').value === CONFIG.ADMIN_PASSWORD) {
      _adminAuth = true;
      $('adminLogin').style.display   = 'none';
      $('adminContent').style.display = '';
      _loadAdminData();
      toast('✅ مرحباً بك يا مدير');
    } else {
      toast('❌ كلمة المرور غير صحيحة');
    }
  }

  async function _loadAdminData() {
    $('atChildren').innerHTML = '<p class="empty-state">جاري التحميل…</p>';
    $('atUpdates').innerHTML  = '<p class="empty-state">جاري التحميل…</p>';
    try {
      const [reqs, upds] = await Promise.all([Sheets.getPendingReqs(), Sheets.getPendingUpds()]);
      _renderReqs(reqs.filter(r=>r.status==='pending'));
      _renderUpds(upds.filter(r=>r.status==='pending'));
    } catch(e) {
      $('atChildren').innerHTML = `<p class="empty-state">خطأ: ${e.message}</p>`;
    }
  }

  function _renderReqs(list) {
    if (!list.length) { $('atChildren').innerHTML = '<p class="empty-state">لا توجد طلبات.</p>'; return; }
    $('atChildren').innerHTML = list.map(r => {
      const p = Tree.getMember(r.parent_id);
      return `<div class="req-card" id="rc_${r.request_id}">
        <div class="req-title">إضافة: <strong>${r.child_name}</strong></div>
        <div class="req-meta">
          الأب/الأم: ${p?p.name:r.parent_id}<br/>
          سنة الميلاد: ${r.birth_date||'—'}<br/>
          مقدّم الطلب: ${r.submitted_by||'—'}
        </div>
        <div class="req-btns">
          <button class="btn-ok" onclick="UI.approveChild('${r.request_id}')">✓ موافقة</button>
          <button class="btn-no" onclick="UI.rejectChild('${r.request_id}')">✕ رفض</button>
        </div>
      </div>`;
    }).join('');
  }

  function _renderUpds(list) {
    if (!list.length) { $('atUpdates').innerHTML = '<p class="empty-state">لا توجد طلبات.</p>'; return; }
    $('atUpdates').innerHTML = list.map(u => `
      <div class="req-card" id="ru_${u.request_id}">
        <div class="req-title">تعديل: <strong>${u.member_name}</strong></div>
        <div class="req-meta">
          ${u.birth_date?`سنة الميلاد: ${u.birth_date}<br/>`:''}
          ${u.phone?`الهاتف: ${u.phone}<br/>`:''}
          ${u.address?`العنوان: ${u.address}<br/>`:''}
          ${u.job?`المهنة: ${u.job}<br/>`:''}
          ${u.note?`ملاحظة: ${u.note}<br/>`:''}
          مقدّم الطلب: ${u.submitted_by||'—'}
        </div>
        <div class="req-btns">
          <button class="btn-ok" onclick="UI.approveUpdate('${u.request_id}')">✓ موافقة</button>
          <button class="btn-no" onclick="UI.rejectUpdate('${u.request_id}')">✕ رفض</button>
        </div>
      </div>`).join('');
  }

  async function _doApprove(id, fn, elId) {
    if (_proc.has(id)) return;
    _proc.add(id);
    const card = $(elId);
    if (card) card.querySelectorAll('button').forEach(b=>{b.disabled=true;b.style.opacity='.5';});
    try { await fn(id); $(elId)?.remove(); toast('✅ تم'); App.reload(); }
    catch(e) { toast('❌ '+e.message); if(card) card.querySelectorAll('button').forEach(b=>{b.disabled=false;b.style.opacity='';});}
    finally { _proc.delete(id); }
  }

  const approveChild  = id => _doApprove(id, Sheets.approveChild,  `rc_${id}`);
  const rejectChild   = id => _doApprove(id, i => Sheets.rejectReq(i,'pending_requests'), `rc_${id}`);
  const approveUpdate = id => _doApprove(id, Sheets.approveUpdate, `ru_${id}`);
  const rejectUpdate  = id => _doApprove(id, Sheets.rejectUpd,     `ru_${id}`);

  // ── PWA ───────────────────────────────────────────────────────────────────
  let _deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _deferredInstall = e; });

  function _setupPWA() {
    if (localStorage.getItem('pwa_shown')) return;
    const sc = $('installScreen');
    sc.style.display = 'flex';

    $('installBtn').onclick = async () => {
      if (_deferredInstall) {
        _deferredInstall.prompt();
        const { outcome } = await _deferredInstall.userChoice;
        _deferredInstall = null;
        if (outcome === 'accepted') { localStorage.setItem('pwa_shown','1'); sc.style.display='none'; }
        else $('installNote').textContent = 'يمكنك التثبيت لاحقاً من قائمة المتصفح';
      } else {
        $('installNote').innerHTML = '<strong>iPhone:</strong> اضغط ⬆️ ثم «إضافة إلى الشاشة الرئيسية»';
      }
    };
    $('installSkip').onclick = () => { localStorage.setItem('pwa_shown','1'); sc.style.display='none'; };
  }

  // ── التهيئة ───────────────────────────────────────────────────────────────
  function init() {
    _setupPWA();

    // لوحة التفاصيل
    $('closeDetail').onclick   = _closeDetail;
    $('panelOverlay').onclick  = _closeDetail;

    // نافذة النموذج
    $('closeModal').onclick    = _closeModal;
    $('modalBack').addEventListener('click', e => { if (e.target===$('modalBack')) _closeModal(); });

    // القائمة المنبثقة
    $('ctxView').onclick    = () => { const id=_curId; _hideMenu(); if(id) _openDetail(id); };
    $('ctxChild').onclick   = () => { const id=_curId; _hideMenu(); if(id) _formAddChild(id); };
    $('ctxEdit').onclick    = () => { const id=_curId; _hideMenu(); if(id) _formEditDetails(id); };
    $('ctxLineage').onclick = () => { const id=_curId; _hideMenu(); if(id) _showLineage(id); };

    document.addEventListener('click',     e => { if (!e.target.closest('#ctxMenu') && !e.target.closest('.node-hit')) _hideMenu(); });
    document.addEventListener('touchstart',e => { if (!e.target.closest('#ctxMenu') && !e.target.closest('.node-hit')) _hideMenu(); }, {passive:true});

    // الإدارة
    $('btnAdmin').onclick     = _openAdmin;
    $('closeAdmin').onclick   = _closeAdmin;
    $('adminLoginBtn').onclick= _adminLogin;
    $('adminBack').addEventListener('click', e => { if (e.target===$('adminBack')) _closeAdmin(); });
    $('adminPw').addEventListener('keydown', e => { if(e.key==='Enter') _adminLogin(); });
    document.querySelectorAll('.atab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.atab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        $('atChildren').style.display = btn.dataset.tab==='children' ? '' : 'none';
        $('atUpdates').style.display  = btn.dataset.tab==='updates'  ? '' : 'none';
      });
    });

    // البحث
    let timer;
    $('searchInput').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(_doSearch, 260); });
    $('searchInput').addEventListener('keydown', e => { if(e.key==='Enter'){clearTimeout(timer);_doSearch();} if(e.key==='Escape') _hideDrop(); });
    $('searchBtn').addEventListener('click', _doSearch);
    document.addEventListener('mousedown', e => { if (!e.target.closest('.search-wrap')) _hideDrop(); });

    // أزرار الأسفل
    $('btnRefresh').onclick = async () => {
      $('btnRefresh').textContent='⏳'; $('btnRefresh').disabled=true;
      await App.reload();
      $('btnRefresh').textContent='🔄 تحديث'; $('btnRefresh').disabled=false;
    };
    $('btnStats').onclick  = _showStats;
    $('btnCenter').onclick = () => Tree.centreOnRoot();
  }

  return { init, onNodeClick, toast, approveChild, rejectChild, approveUpdate, rejectUpdate };
})();
/**
 * app.js — نقطة الدخول
 */
const App = (() => {
  const KEY = 'shajarah_members_v2';

  function _save(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch(e){} }
  function _load()  { try { const d=localStorage.getItem(KEY); return d?JSON.parse(d):null; } catch(e){ return null; } }

  function _hideLoader() {
    const el = document.getElementById('loader');
    el.classList.add('out');
    setTimeout(() => el.remove(), 600);
  }

  async function _fetchAndRender(showLoader = true) {
    try {
      const members = await Sheets.getMembers();
      if (members.length) {
        _save(members);
        Tree.render(members);
        return true;
      }
    } catch(e) {
      console.warn('fetch error:', e.message);
    }
    return false;
  }

  async function load() {
    const cached = _load();

    if (cached && cached.length) {
      // عرض البيانات المحفوظة فوراً
      Tree.render(cached);
      _hideLoader();
      // تحديث في الخلفية
      _fetchAndRender(false).then(ok => { if(ok) UI.toast('🔄 تم تحديث البيانات'); });
    } else {
      // أول مرة — تحميل من الشبكة
      document.getElementById('loaderMsg').textContent = 'جاري التحميل من الشبكة…';
      const ok = await _fetchAndRender();
      if (!ok) {
        document.getElementById('loaderMsg').textContent = '⚠️ لا يوجد اتصال ولا بيانات محفوظة';
        setTimeout(_hideLoader, 2500);
      } else {
        _hideLoader();
      }
    }
  }

  async function reload() {
    const ok = await _fetchAndRender(false);
    if (!ok) UI.toast('⚠️ تعذّر التحديث');
  }

  function init() {
    UI.init();
    load();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
          .catch(e => console.warn('SW:', e));
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  return { reload };
})();
