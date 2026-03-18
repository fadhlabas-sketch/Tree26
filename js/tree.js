/**
 * tree.js — محرك الشجرة
 * =======================
 * الإصلاحات:
 *  1. SVG والعقد في wrapper واحد ← يحل انفصال الخطوط عند الزوم
 *  2. transform-origin ثابت دائماً
 *  3. إضافة وظيفة highlightLineage() لإظهار مسار الأصل
 */

const Tree = (() => {

  let _members   = [];
  let _nodeMap   = {};
  let _positions = {};
  let _pan       = { x: 0, y: 0 };
  let _zoom      = 1;
  let _isDragging = false;
  let _dragStart  = { x: 0, y: 0, px: 0, py: 0 };

  // المراجع الثابتة
  const getCt      = () => document.getElementById('treeContainer');
  const getWrapper = () => document.getElementById('treeWrapper');   // wrapper جديد
  const getNodes   = () => document.getElementById('nodesContainer');
  const getSvg     = () => document.getElementById('linksSvg');

  // ── بناء خريطة id → عضو ──────────────────────────────────────────────────
  function _buildMap(members) {
    _nodeMap = {};
    members.forEach(m => { _nodeMap[m.id] = m; });
  }

  // ── تخطيط الشجرة ──────────────────────────────────────────────────────────
  function _layoutTree(members) {
    const W = CONFIG.LAYOUT.NODE_WIDTH  + CONFIG.LAYOUT.H_SPACING;
    const H = CONFIG.LAYOUT.NODE_HEIGHT + CONFIG.LAYOUT.V_SPACING;

    const roots = members.filter(m => !m.parent_id || !_nodeMap[m.parent_id]);

    const childrenOf = {};
    members.forEach(m => {
      if (!childrenOf[m.id]) childrenOf[m.id] = [];
      if (m.parent_id && _nodeMap[m.parent_id]) {
        if (!childrenOf[m.parent_id]) childrenOf[m.parent_id] = [];
        childrenOf[m.parent_id].push(m.id);
      }
    });

    const positions = {};
    let xCounter = 0;

    function assignX(id, depth) {
      const children = childrenOf[id] || [];
      if (children.length === 0) {
        positions[id] = { x: xCounter * W, y: depth * H };
        xCounter++;
      } else {
        children.forEach(cid => assignX(cid, depth + 1));
        const first = positions[children[0]].x;
        const last  = positions[children[children.length - 1]].x;
        positions[id] = { x: (first + last) / 2, y: depth * H };
      }
    }

    roots.forEach(r => assignX(r.id, 0));

    members.forEach(m => {
      if (!positions[m.id]) {
        positions[m.id] = { x: xCounter * W, y: 0 };
        xCounter++;
      }
    });

    return positions;
  }

  // ── رسم العقد ─────────────────────────────────────────────────────────────
  function _renderNodes(members, positions) {
    const div = getNodes();
    div.innerHTML = '';
    members.forEach(m => {
      const pos = positions[m.id];
      if (!pos) return;

      const el = document.createElement('div');
      el.className  = 'tree-node';
      el.dataset.id = m.id;
      el.style.left  = pos.x + 'px';
      el.style.top   = pos.y + 'px';
      el.style.width = CONFIG.LAYOUT.NODE_WIDTH + 'px';

      const nameEl = document.createElement('div');
      nameEl.className   = 'node-name';
      nameEl.textContent = m.name;
      el.appendChild(nameEl);

      div.appendChild(el);
    });
  }

  // ── رسم الروابط ───────────────────────────────────────────────────────────
  function _renderLinks(members, positions) {
    let paths = '';
    members.forEach(m => {
      if (!m.parent_id || !positions[m.parent_id] || !positions[m.id]) return;

      const px   = positions[m.parent_id].x + CONFIG.LAYOUT.NODE_WIDTH / 2;
      const py   = positions[m.parent_id].y + CONFIG.LAYOUT.NODE_HEIGHT;
      const cx   = positions[m.id].x        + CONFIG.LAYOUT.NODE_WIDTH / 2;
      const cy   = positions[m.id].y;
      const midY = (py + cy) / 2;

      paths += `<path class="tree-link" data-child="${m.id}" data-parent="${m.parent_id}"
        d="M${px},${py} C${px},${midY} ${cx},${midY} ${cx},${cy}"/>`;
    });
    getSvg().innerHTML = paths;
  }

  // ── ضبط حجم SVG والـ wrapper ──────────────────────────────────────────────
  function _fitCanvas(positions) {
    let maxX = 0, maxY = 0;
    Object.values(positions).forEach(p => {
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    const w = maxX + CONFIG.LAYOUT.NODE_WIDTH  + 300;
    const h = maxY + CONFIG.LAYOUT.NODE_HEIGHT + 300;

    // SVG بنفس حجم مساحة الشجرة
    const svgEl = getSvg();
    svgEl.style.width  = w + 'px';
    svgEl.style.height = h + 'px';
    svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);

    // العقد تأخذ نفس الحجم
    getNodes().style.width  = w + 'px';
    getNodes().style.height = h + 'px';

    // الـ wrapper يحتوي كليهما
    getWrapper().style.width  = w + 'px';
    getWrapper().style.height = h + 'px';
  }

  // ── تطبيق Transform على الـ wrapper الواحد فقط ───────────────────────────
  // هذا هو جوهر الإصلاح: transform واحد يحرك SVG والعقد معاً
  function _applyTransform() {
    getWrapper().style.transform = `translate(${_pan.x}px, ${_pan.y}px) scale(${_zoom})`;
  }

  // ── تهيئة السحب والتكبير ─────────────────────────────────────────────────
  function _initPanZoom() {
    const ct = getCt();

    // سحب بالماوس
    ct.addEventListener('mousedown', e => {
      if (e.target.closest('.tree-node')) return;
      _isDragging = true;
      _dragStart  = { x: e.clientX, y: e.clientY, px: _pan.x, py: _pan.y };
      ct.classList.add('grabbing');
    });
    window.addEventListener('mousemove', e => {
      if (!_isDragging) return;
      _pan.x = _dragStart.px + (e.clientX - _dragStart.x);
      _pan.y = _dragStart.py + (e.clientY - _dragStart.y);
      _applyTransform();
    });
    window.addEventListener('mouseup', () => {
      _isDragging = false;
      ct.classList.remove('grabbing');
    });

    // سحب باللمس
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

    // تكبير بالعجلة — يتمركز حول نقطة الماوس
    ct.addEventListener('wheel', e => {
      e.preventDefault();
      const rect  = ct.getBoundingClientRect();
      const mx    = e.clientX - rect.left;
      const my    = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(2.5, Math.max(0.15, _zoom * delta));

      // تعديل الإزاحة حتى تبقى نقطة الماوس ثابتة
      _pan.x = mx - (mx - _pan.x) * (newZoom / _zoom);
      _pan.y = my - (my - _pan.y) * (newZoom / _zoom);
      _zoom  = newZoom;
      _applyTransform();
    }, { passive: false });

    // تكبير بإصبعين
    let initDist = 0, initZoom = 1, pinchCx = 0, pinchCy = 0;
    ct.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        initDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initZoom = _zoom;
        const rect = ct.getBoundingClientRect();
        pinchCx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        pinchCy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      }
    }, { passive: true });
    ct.addEventListener('touchmove', e => {
      if (e.touches.length !== 2) return;
      const dist    = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const newZoom = Math.min(2.5, Math.max(0.15, initZoom * (dist / initDist)));
      _pan.x = pinchCx - (pinchCx - _pan.x) * (newZoom / _zoom);
      _pan.y = pinchCy - (pinchCy - _pan.y) * (newZoom / _zoom);
      _zoom  = newZoom;
      _applyTransform();
    }, { passive: true });

    // أزرار التكبير
    const zoomDiv = document.createElement('div');
    zoomDiv.className = 'zoom-controls';
    zoomDiv.innerHTML = `
      <button class="zoom-btn" id="zoomIn"    title="تكبير">+</button>
      <button class="zoom-btn" id="zoomOut"   title="تصغير">−</button>
      <button class="zoom-btn" id="zoomReset" title="إعادة ضبط">⌂</button>
    `;
    document.body.appendChild(zoomDiv);

    document.getElementById('zoomIn').onclick    = () => { _zoom = Math.min(2.5, _zoom * 1.2); _applyTransform(); };
    document.getElementById('zoomOut').onclick   = () => { _zoom = Math.max(0.15, _zoom * 0.8); _applyTransform(); };
    document.getElementById('zoomReset').onclick = () => centreOnRoot();
  }

  // ── التمركز على عقدة ─────────────────────────────────────────────────────
  function centreOnNode(id) {
    const pos = _positions[id];
    if (!pos) return;
    const ct = getCt();
    _zoom  = 1.2;
    _pan.x = ct.clientWidth  / 2 - (pos.x + CONFIG.LAYOUT.NODE_WIDTH  / 2) * _zoom;
    _pan.y = ct.clientHeight / 2 - (pos.y + CONFIG.LAYOUT.NODE_HEIGHT / 2) * _zoom;
    _applyTransform();
  }

  function centreOnRoot() {
    if (_members.length === 0) return;
    const root = _members.find(m => !m.parent_id || !_nodeMap[m.parent_id]) || _members[0];
    const pos  = _positions[root.id];
    if (!pos) return;
    const ct = getCt();
    _zoom  = 0.9;
    _pan.x = ct.clientWidth / 2 - (pos.x + CONFIG.LAYOUT.NODE_WIDTH / 2) * _zoom;
    _pan.y = 40;
    _applyTransform();
  }

  // ── تمييز عقدة بالبحث ────────────────────────────────────────────────────
  function highlight(id) {
    document.querySelectorAll('.tree-node.highlighted').forEach(n => n.classList.remove('highlighted'));
    const el = document.querySelector(`.tree-node[data-id="${id}"]`);
    if (el) el.classList.add('highlighted');
  }

  // ── إظهار مسار الأصل (سلسلة الأجداد) ────────────────────────────────────
  // يُلوّن كل الروابط والعقد من الشخص المحدد حتى أعلى جد
  function highlightLineage(id) {
    // أزل التمييز السابق
    clearLineage();

    const ancestorIds = new Set();
    let current = id;
    while (current) {
      ancestorIds.add(current);
      const m = _nodeMap[current];
      current = m?.parent_id && _nodeMap[m.parent_id] ? m.parent_id : null;
    }

    // لوّن العقد
    ancestorIds.forEach(aid => {
      const el = document.querySelector(`.tree-node[data-id="${aid}"]`);
      if (el) el.classList.add('lineage-node');
    });

    // لوّن الروابط
    document.querySelectorAll('.tree-link').forEach(path => {
      const child  = path.getAttribute('data-child');
      const parent = path.getAttribute('data-parent');
      if (ancestorIds.has(child) && ancestorIds.has(parent)) {
        path.classList.add('lineage-link');
      }
    });

    return ancestorIds;
  }

  function clearLineage() {
    document.querySelectorAll('.tree-node.lineage-node').forEach(n => n.classList.remove('lineage-node'));
    document.querySelectorAll('.tree-link.lineage-link').forEach(p => p.classList.remove('lineage-link'));
  }

  // ── العرض الكامل ─────────────────────────────────────────────────────────
  function render(members) {
    _members   = members;
    _buildMap(members);
    _positions = _layoutTree(members);
    _renderNodes(members, _positions);
    _renderLinks(members, _positions);
    _fitCanvas(_positions);
    centreOnRoot();
  }

  function getMember(id) { return _nodeMap[id]; }
  function getMembers()  { return _members; }
  function getPositions() { return _positions; }

  return {
    render,
    centreOnNode,
    centreOnRoot,
    highlight,
    highlightLineage,
    clearLineage,
    getMember,
    getMembers,
    getPositions,
    initPanZoom: _initPanZoom,
  };
})();
 