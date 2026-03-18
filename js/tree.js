/**
 * tree.js — شجرة العائلة
 * =======================
 * التصميم: شجرة تنمو من الأسفل للأعلى
 * - الجذر في الأسفل
 * - الأبناء فوقه
 * - عقد بيضاوية مع الاسم
 * - أغصان منحنية طبيعية
 */

const Tree = (() => {

  // ── إعدادات التخطيط ───────────────────────────────────────────────────────
  const CFG = {
    OW:      90,   // عرض البيضاوية
    OH:      38,   // ارتفاع البيضاوية
    H_GAP:   20,   // مسافة أفقية بين العقد
    V_GAP:   80,   // مسافة رأسية بين الأجيال
    // لون كل جيل (من الأسفل للأعلى)
    GEN_COLORS: ['#4a3728','#5c4033','#6b4e3d','#7a5c48','#886954','#967760'],
  };

  let _members   = [];
  let _nodeMap   = {};
  let _positions = {};
  let _pan       = { x: 0, y: 0 };
  let _zoom      = 1;
  let _dragging  = false;
  let _ds        = {};

  const getCt      = () => document.getElementById('treeContainer');
  const getWrapper = () => document.getElementById('treeWrapper');
  const getNodes   = () => document.getElementById('nodesContainer');
  const getSvg     = () => document.getElementById('linksSvg');

  // ── بناء الخريطة ──────────────────────────────────────────────────────────
  function _buildMap(members) {
    _nodeMap = {};
    members.forEach(m => (_nodeMap[m.id] = m));
  }

  // ── بناء خريطة الأبناء ────────────────────────────────────────────────────
  function _buildChildMap(members) {
    const ch = {};
    members.forEach(m => {
      ch[m.id] = ch[m.id] || [];
      if (m.parent_id && _nodeMap[m.parent_id]) {
        ch[m.parent_id] = ch[m.parent_id] || [];
        ch[m.parent_id].push(m.id);
      }
    });
    return ch;
  }

  // ── حساب عمق كل عقدة ─────────────────────────────────────────────────────
  function _calcDepths(members, childMap) {
    const depths = {};
    // الجذور عمقها 0
    members.forEach(m => {
      if (!m.parent_id || !_nodeMap[m.parent_id]) depths[m.id] = 0;
    });
    // BFS
    const queue = Object.keys(depths);
    let i = 0;
    while (i < queue.length) {
      const id = queue[i++];
      (childMap[id] || []).forEach(cid => {
        depths[cid] = depths[id] + 1;
        queue.push(cid);
      });
    }
    members.forEach(m => { if (depths[m.id] === undefined) depths[m.id] = 0; });
    return depths;
  }

  // ── تخطيط الشجرة (الجذر أسفل، الأبناء أعلى) ─────────────────────────────
  function _layout(members) {
    const childMap = _buildChildMap(members);
    const depths   = _calcDepths(members, childMap);
    const maxDepth = Math.max(...Object.values(depths));

    // الجذور
    const roots = members.filter(m => !m.parent_id || !_nodeMap[m.parent_id]);

    const pos = {};
    let leafX = 0;

    // post-order: الأوراق أولاً ← تحديد X
    function assignX(id) {
      const children = childMap[id] || [];
      if (children.length === 0) {
        pos[id] = { leafX };
        leafX++;
      } else {
        children.forEach(c => assignX(c));
        const first = pos[children[0]].leafX;
        const last  = pos[children[children.length - 1]].leafX;
        pos[id] = { leafX: (first + last) / 2 };
      }
    }
    roots.forEach(r => assignX(r.id));

    // أعضاء بدون موضع
    members.forEach(m => {
      if (!pos[m.id]) { pos[m.id] = { leafX }; leafX++; }
    });

    // الـ unit: عرض الخانة
    const unit = CFG.OW + CFG.H_GAP;

    // تحويل إلى إحداثيات حقيقية
    // Y: الجذر (depth=0) في الأسفل، الأوراق في الأعلى
    const result = {};
    members.forEach(m => {
      const d = depths[m.id];
      // y: كلما زاد العمق كلما ارتفعنا (maxDepth في أعلى)
      const yFromTop = (maxDepth - d) * (CFG.OH + CFG.V_GAP) + 20;
      result[m.id] = {
        x:     pos[m.id].leafX * unit + CFG.OW / 2,
        y:     yFromTop + CFG.OH / 2,
        depth: d,
        color: CFG.GEN_COLORS[Math.min(d, CFG.GEN_COLORS.length - 1)],
      };
    });

    return result;
  }

  // ── رسم العقد (بيضاوية + اسم) ────────────────────────────────────────────
  function _renderNodes(members, pos) {
    const div = getNodes();
    div.innerHTML = '';

    members.forEach(m => {
      const p = pos[m.id];
      if (!p) return;

      const el = document.createElement('div');
      el.className  = 'tree-node';
      el.dataset.id = m.id;

      // تمركز البيضاوية على النقطة (x, y)
      el.style.left   = (p.x - CFG.OW / 2) + 'px';
      el.style.top    = (p.y - CFG.OH / 2) + 'px';
      el.style.width  = CFG.OW + 'px';
      el.style.height = CFG.OH + 'px';
      el.style.setProperty('--nc', p.color);

      el.innerHTML = `<span class="node-text">${m.name}</span>`;
      div.appendChild(el);
    });
  }

  // ── رسم الأغصان ───────────────────────────────────────────────────────────
  function _renderLinks(members, pos) {
    const childMap = _buildChildMap(members);
    let paths = '';

    Object.keys(childMap).forEach(pid => {
      const children = childMap[pid];
      if (!pos[pid]) return;

      const pp = pos[pid];
      // نقطة خروج الغصن: من أعلى البيضاوية للأب (لأن الأبناء فوقه)
      const sx = pp.x;
      const sy = pp.y - CFG.OH / 2;  // أعلى البيضاوية

      children.forEach(cid => {
        const cp = pos[cid];
        if (!cp) return;
        // نقطة دخول: أسفل بيضاوية الابن
        const ex = cp.x;
        const ey = cp.y + CFG.OH / 2;

        // منحنى Cubic Bezier طبيعي
        const c1y = sy - (sy - ey) * 0.35;
        const c2y = ey + (sy - ey) * 0.35;

        paths += `<path
          class="tree-link"
          data-parent="${pid}"
          data-child="${cid}"
          d="M${sx},${sy} C${sx},${c1y} ${ex},${c2y} ${ex},${ey}"
          stroke="${pp.color}"
        />`;
      });
    });

    getSvg().innerHTML = paths;
  }

  // ── ضبط حجم الـ Canvas ────────────────────────────────────────────────────
  function _fitCanvas(pos) {
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    Object.values(pos).forEach(p => {
      if (p.x - CFG.OW / 2 < minX) minX = p.x - CFG.OW / 2;
      if (p.y - CFG.OH / 2 < minY) minY = p.y - CFG.OH / 2;
      if (p.x + CFG.OW / 2 > maxX) maxX = p.x + CFG.OW / 2;
      if (p.y + CFG.OH / 2 > maxY) maxY = p.y + CFG.OH / 2;
    });

    const pad = 40;
    const w   = maxX + pad;
    const h   = maxY + pad;

    const svg = getSvg();
    svg.style.width  = w + 'px';
    svg.style.height = h + 'px';
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    getNodes().style.width    = w + 'px';
    getNodes().style.height   = h + 'px';
    getWrapper().style.width  = w + 'px';
    getWrapper().style.height = h + 'px';
  }

  // ── Transform ─────────────────────────────────────────────────────────────
  function _applyTransform() {
    getWrapper().style.transform =
      `translate(${_pan.x}px,${_pan.y}px) scale(${_zoom})`;
  }

  // ── التمركز على الجذر (يظهر في أسفل الشاشة) ──────────────────────────────
  function centreOnRoot() {
    if (!_members.length) return;
    const root = _members.find(m => !m.parent_id || !_nodeMap[m.parent_id]) || _members[0];
    const p    = _positions[root.id];
    if (!p) return;
    const ct = getCt();
    _zoom  = 0.85;

    // الجذر يظهر في أسفل الشاشة ومتوسط أفقياً
    _pan.x = ct.clientWidth  / 2 - p.x * _zoom;
    _pan.y = ct.clientHeight - (p.y + CFG.OH) * _zoom - 30;
    _applyTransform();
  }

  // ── التمركز على عقدة محددة ────────────────────────────────────────────────
  function centreOnNode(id) {
    const p = _positions[id];
    if (!p) return;
    const ct = getCt();
    _zoom  = 1.3;
    _pan.x = ct.clientWidth  / 2 - p.x * _zoom;
    _pan.y = ct.clientHeight / 2 - p.y * _zoom;
    _applyTransform();
  }

  // ── السحب والتكبير ────────────────────────────────────────────────────────
  function _initPanZoom() {
    const ct = getCt();

    ct.addEventListener('mousedown', e => {
      if (e.target.closest('.tree-node')) return;
      _dragging = true;
      _ds = { x: e.clientX, y: e.clientY, px: _pan.x, py: _pan.y };
      ct.classList.add('grabbing');
    });
    window.addEventListener('mousemove', e => {
      if (!_dragging) return;
      _pan.x = _ds.px + (e.clientX - _ds.x);
      _pan.y = _ds.py + (e.clientY - _ds.y);
      _applyTransform();
    });
    window.addEventListener('mouseup', () => {
      _dragging = false;
      ct.classList.remove('grabbing');
    });

    let t0 = null;
    ct.addEventListener('touchstart', e => {
      if (e.touches.length === 1 && !e.target.closest('.tree-node')) {
        t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: _pan.x, py: _pan.y };
      }
    }, { passive: true });
    ct.addEventListener('touchmove', e => {
      if (!t0 || e.touches.length !== 1) return;
      _pan.x = t0.px + (e.touches[0].clientX - t0.x);
      _pan.y = t0.py + (e.touches[0].clientY - t0.y);
      _applyTransform();
    }, { passive: true });
    ct.addEventListener('touchend', () => { t0 = null; });

    ct.addEventListener('wheel', e => {
      e.preventDefault();
      const r  = ct.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const d  = e.deltaY > 0 ? 0.9 : 1.1;
      const nz = Math.min(3, Math.max(0.1, _zoom * d));
      _pan.x = mx - (mx - _pan.x) * (nz / _zoom);
      _pan.y = my - (my - _pan.y) * (nz / _zoom);
      _zoom  = nz;
      _applyTransform();
    }, { passive: false });

    let iD = 0, iZ = 1, pcx = 0, pcy = 0;
    ct.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        iD = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        iZ = _zoom;
        const r = ct.getBoundingClientRect();
        pcx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
        pcy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
      }
    }, { passive: true });
    ct.addEventListener('touchmove', e => {
      if (e.touches.length !== 2) return;
      const d  = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const nz = Math.min(3, Math.max(0.1, iZ * (d / iD)));
      _pan.x = pcx - (pcx - _pan.x) * (nz / _zoom);
      _pan.y = pcy - (pcy - _pan.y) * (nz / _zoom);
      _zoom  = nz;
      _applyTransform();
    }, { passive: true });

    const rBtn = document.getElementById('refreshBtn');
    const sBtn = document.getElementById('statsBtn');
    if (rBtn) rBtn.onclick = async () => {
      rBtn.textContent = '⏳';
      rBtn.disabled = true;
      await App.reload();
      rBtn.textContent = '🔄 تحديث';
      rBtn.disabled = false;
    };
    if (sBtn) sBtn.onclick = _showStats;
  }

  // ── تمييز (بحث) ───────────────────────────────────────────────────────────
  function highlight(id) {
    document.querySelectorAll('.tree-node.highlighted')
      .forEach(n => n.classList.remove('highlighted'));
    const el = document.querySelector(`.tree-node[data-id="${id}"]`);
    if (el) el.classList.add('highlighted');
  }

  // ── مسار الأصل ────────────────────────────────────────────────────────────
  function highlightLineage(id) {
    clearLineage();
    const ancs = new Set();
    let cur = id;
    while (cur) {
      ancs.add(cur);
      const m = _nodeMap[cur];
      cur = m?.parent_id && _nodeMap[m.parent_id] ? m.parent_id : null;
    }
    ancs.forEach(aid => {
      document.querySelector(`.tree-node[data-id="${aid}"]`)?.classList.add('lineage-node');
    });
    document.querySelectorAll('.tree-link').forEach(p => {
      if (ancs.has(p.dataset.child) && ancs.has(p.dataset.parent))
        p.classList.add('lineage-link');
    });
    return ancs;
  }

  function clearLineage() {
    document.querySelectorAll('.lineage-node').forEach(n => n.classList.remove('lineage-node'));
    document.querySelectorAll('.lineage-link').forEach(p => p.classList.remove('lineage-link'));
  }

  // ── الإحصائيات ────────────────────────────────────────────────────────────
  function _showStats() {
    const total = _members.length;
    const freq  = {};
    _members.forEach(m => {
      const w = (m.name || '').split(/\s+/)[0];
      if (w) freq[w] = (freq[w] || 0) + 1;
    });
    const top3 = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const bd = document.createElement('div');
    bd.className = 'stats-backdrop';
    bd.innerHTML = `
      <div class="stats-box">
        <button class="stats-close" id="statsClose">✕</button>
        <div class="stats-icon">📊</div>
        <h2 class="stats-title">إحصائيات الشجرة</h2>
        <div class="stats-total">
          <span class="stats-total-num">${total}</span>
          <span class="stats-total-label">فرد في الشجرة</span>
        </div>
        <div class="stats-section-title">أكثر الأسماء تكراراً</div>
        <div class="stats-names">
          ${top3.map(([n, c], i) => `
            <div class="stats-name-row">
              <span class="stats-rank">${['🥇','🥈','🥉'][i]}</span>
              <span class="stats-name">${n}</span>
              <span class="stats-count">${c} مرة</span>
            </div>`).join('')}
        </div>
        <div class="stats-credit">
          تم إنشاء هذا البرنامج من قبل<br/>
          <strong>فضل عباس زينل</strong><br/>
          <a href="tel:07501377753" class="stats-phone">📞 07501377753</a>
        </div>
      </div>`;
    document.body.appendChild(bd);
    document.getElementById('statsClose').onclick = () => bd.remove();
    bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  }

  // ── العرض الكامل ──────────────────────────────────────────────────────────
  function render(members) {
    _members   = members;
    _buildMap(members);
    _positions = _layout(members);
    _renderNodes(members, _positions);
    _renderLinks(members, _positions);
    _fitCanvas(_positions);
    centreOnRoot();
  }

  function getMember(id) { return _nodeMap[id]; }
  function getMembers()  { return _members; }

  return {
    render, centreOnNode, centreOnRoot,
    highlight, highlightLineage, clearLineage,
    getMember, getMembers,
    initPanZoom: _initPanZoom,
  };
})();
