/**
 * tree.js
 * =======
 * Builds a Reingold–Tilford-style tree layout and renders
 * nodes + SVG links.  Supports pan & zoom for 600+ members.
 */

const Tree = (() => {

  // ── State ─────────────────────────────────────────────────────────────────
  let _members   = [];   // raw data from Sheets
  let _nodeMap   = {};   // id → member
  let _positions = {};   // id → {x, y}
  let _pan       = { x: 0, y: 0 };
  let _zoom      = 1;
  let _isDragging = false;
  let _dragStart  = { x: 0, y: 0, px: 0, py: 0 };

  const container  = () => document.getElementById('treeContainer');
  const nodesDiv   = () => document.getElementById('nodesContainer');
  const svg        = () => document.getElementById('linksSvg');

  // ── Build lookup map ──────────────────────────────────────────────────────
  function _buildMap(members) {
    _nodeMap = {};
    members.forEach(m => { _nodeMap[m.id] = m; });
  }

  // ── Reingold–Tilford layout ───────────────────────────────────────────────
  // Returns positions {x,y} for each node id.
  // We do a two-pass: first assign x by in-order traversal, then y by depth.

  function _layoutTree(members) {
    const W = CONFIG.LAYOUT.NODE_WIDTH  + CONFIG.LAYOUT.H_SPACING;
    const H = CONFIG.LAYOUT.NODE_HEIGHT + CONFIG.LAYOUT.V_SPACING;

    // Find roots (members with no parent, or parent not in map)
    const roots = members.filter(m => !m.parent_id || !_nodeMap[m.parent_id]);

    // Build children map
    const childrenOf = {};
    members.forEach(m => {
      if (!childrenOf[m.id]) childrenOf[m.id] = [];
      if (m.parent_id && _nodeMap[m.parent_id]) {
        if (!childrenOf[m.parent_id]) childrenOf[m.parent_id] = [];
        childrenOf[m.parent_id].push(m.id);
      }
    });

    const positions = {};
    let xCounter = 0;  // global left-to-right counter for leaves

    // Post-order: assign x so each node is centred over its children
    function assignX(id, depth) {
      const children = childrenOf[id] || [];
      if (children.length === 0) {
        // Leaf node
        positions[id] = { x: xCounter * W, y: depth * H };
        xCounter++;
      } else {
        children.forEach(cid => assignX(cid, depth + 1));
        // Parent centred over first and last child
        const first = positions[children[0]].x;
        const last  = positions[children[children.length - 1]].x;
        positions[id] = { x: (first + last) / 2, y: depth * H };
      }
    }

    roots.forEach(r => assignX(r.id, 0));

    // Handle orphans (members whose parent_id was set but parent is missing)
    members.forEach(m => {
      if (!positions[m.id]) {
        positions[m.id] = { x: xCounter * W, y: 0 };
        xCounter++;
      }
    });

    return positions;
  }

  // ── Render nodes ──────────────────────────────────────────────────────────
  function _renderNodes(members, positions) {
    const container = nodesDiv();
    container.innerHTML = '';

    members.forEach(m => {
      const pos = positions[m.id];
      if (!pos) return;

      const el = document.createElement('div');
      el.className = 'tree-node';
      el.dataset.id = m.id;
      el.style.left = pos.x + 'px';
      el.style.top  = pos.y + 'px';
      el.style.width = CONFIG.LAYOUT.NODE_WIDTH + 'px';

      const nameEl = document.createElement('div');
      nameEl.className = 'node-name';
      nameEl.textContent = m.name;
      el.appendChild(nameEl);

      container.appendChild(el);
    });
  }

  // ── Render SVG links ──────────────────────────────────────────────────────
  function _renderLinks(members, positions) {
    const el = svg();
    // Use innerHTML for performance on 600+ nodes
    let paths = '';

    members.forEach(m => {
      if (!m.parent_id || !positions[m.parent_id] || !positions[m.id]) return;

      const px = positions[m.parent_id].x + CONFIG.LAYOUT.NODE_WIDTH / 2;
      const py = positions[m.parent_id].y + CONFIG.LAYOUT.NODE_HEIGHT;
      const cx = positions[m.id].x + CONFIG.LAYOUT.NODE_WIDTH / 2;
      const cy = positions[m.id].y;

      const midY = (py + cy) / 2;
      paths += `<path class="tree-link" d="M${px},${py} C${px},${midY} ${cx},${midY} ${cx},${cy}" />`;
    });

    el.innerHTML = paths;
  }

  // ── Resize SVG to cover full virtual canvas ───────────────────────────────
  function _fitSvg(positions) {
    const el = svg();
    let maxX = 0, maxY = 0;
    Object.values(positions).forEach(p => {
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    const w = maxX + CONFIG.LAYOUT.NODE_WIDTH  + 200;
    const h = maxY + CONFIG.LAYOUT.NODE_HEIGHT + 200;
    el.style.width  = w + 'px';
    el.style.height = h + 'px';
    el.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  // ── Pan & Zoom ────────────────────────────────────────────────────────────
  function _applyTransform() {
    nodesDiv().style.transform = `translate(${_pan.x}px,${_pan.y}px) scale(${_zoom})`;
    svg().style.transform       = `translate(${_pan.x}px,${_pan.y}px) scale(${_zoom})`;
  }

  function _initPanZoom() {
    const ct = container();

    // ── Mouse drag ──
    ct.addEventListener('mousedown', e => {
      if (e.target.closest('.tree-node')) return;
      _isDragging = true;
      _dragStart = { x: e.clientX, y: e.clientY, px: _pan.x, py: _pan.y };
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

    // ── Touch drag ──
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

    // ── Mouse wheel zoom ──
    ct.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      _zoom = Math.min(2, Math.max(0.2, _zoom * delta));
      _applyTransform();
    }, { passive: false });

    // ── Pinch zoom ──
    let initDist = 0, initZoom = 1;
    ct.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        initDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initZoom = _zoom;
      }
    }, { passive: true });
    ct.addEventListener('touchmove', e => {
      if (e.touches.length !== 2) return;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      _zoom = Math.min(2, Math.max(0.2, initZoom * (dist / initDist)));
      _applyTransform();
    }, { passive: true });

    // ── Zoom buttons ──
    const zoomControls = document.createElement('div');
    zoomControls.className = 'zoom-controls';
    zoomControls.innerHTML = `
      <button class="zoom-btn" id="zoomIn" title="Zoom In">+</button>
      <button class="zoom-btn" id="zoomOut" title="Zoom Out">−</button>
      <button class="zoom-btn" id="zoomReset" title="Reset" style="font-size:13px">⌂</button>
    `;
    document.body.appendChild(zoomControls);

    document.getElementById('zoomIn').onclick    = () => { _zoom = Math.min(2, _zoom * 1.2); _applyTransform(); };
    document.getElementById('zoomOut').onclick   = () => { _zoom = Math.max(0.2, _zoom * 0.8); _applyTransform(); };
    document.getElementById('zoomReset').onclick = () => centreOnRoot();
  }

  // ── Centre view on a specific node ───────────────────────────────────────
  function centreOnNode(id) {
    const pos = _positions[id];
    if (!pos) return;
    const ct = container();
    const vw = ct.clientWidth;
    const vh = ct.clientHeight;
    _zoom = 1;
    _pan.x = vw / 2 - (pos.x + CONFIG.LAYOUT.NODE_WIDTH / 2);
    _pan.y = vh / 2 - (pos.y + CONFIG.LAYOUT.NODE_HEIGHT / 2) - 20;
    _applyTransform();
  }

  function centreOnRoot() {
    if (_members.length === 0) return;
    const root = _members.find(m => !m.parent_id || !_nodeMap[m.parent_id]) || _members[0];
    _zoom = 0.8;
    const ct = container();
    _pan.x = ct.clientWidth / 2 - (_positions[root.id]?.x || 0) - CONFIG.LAYOUT.NODE_WIDTH / 2;
    _pan.y = 40;
    _applyTransform();
  }

  // ── Public: full render ───────────────────────────────────────────────────
  function render(members) {
    _members = members;
    _buildMap(members);
    _positions = _layoutTree(members);
    _renderNodes(members, _positions);
    _renderLinks(members, _positions);
    _fitSvg(_positions);
    centreOnRoot();
  }

  // ── Public: highlight a node ──────────────────────────────────────────────
  function highlight(id) {
    document.querySelectorAll('.tree-node.highlighted').forEach(n => n.classList.remove('highlighted'));
    const el = document.querySelector(`.tree-node[data-id="${id}"]`);
    if (el) el.classList.add('highlighted');
  }

  // ── Public: get member by id ──────────────────────────────────────────────
  function getMember(id) { return _nodeMap[id]; }

  // ── Public: get all members ───────────────────────────────────────────────
  function getMembers() { return _members; }

  return {
    render,
    centreOnNode,
    centreOnRoot,
    highlight,
    getMember,
    getMembers,
    initPanZoom: _initPanZoom,
  };
})();
