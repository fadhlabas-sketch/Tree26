/**
 * tree.js — شجرة العائلة
 * =======================
 * تصميم بصري: أغصان منحنية طبيعية + عقد دائرية + ألوان حسب الجيل
 * مناسب للهاتف: عرض ضيق، تمرير رأسي، تكبير بالإصبعين
 */

const Tree = (() => {

  // ── الإعدادات البصرية ──────────────────────────────────────────────────────
  const CFG = {
    NODE_R:    26,    // نصف قطر الدائرة
    NODE_W:    90,    // عرض الخانة المخصصة لكل عقدة
    LEV_H:    130,    // المسافة الرأسية بين الأجيال
    // ألوان الأجيال (تتكرر)
    COLORS: ['#d4a843','#4caf7d','#5b8dee','#e05c8a','#9b72cf','#e07c5c'],
  };

  let _members   = [];
  let _nodeMap   = {};
  let _positions = {};  // id → {x, y, depth, color}
  let _pan       = { x: 0, y: 0 };
  let _zoom      = 1;
  let _dragging  = false;
  let _dragStart = {};

  const getCt      = () => document.getElementById('treeContainer');
  const getWrapper = () => document.getElementById('treeWrapper');
  const getNodes   = () => document.getElementById('nodesContainer');
  const getSvg     = () => document.getElementById('linksSvg');

  // ── بناء الخريطة ─────────────────────────────────────────────────────────
  function _buildMap(members) {
    _nodeMap = {};
    members.forEach(m => (_nodeMap[m.id] = m));
  }

  // ── تخطيط الشجرة (Reingold-Tilford) ──────────────────────────────────────
  function _layout(members) {
    // بناء خريطة الأبناء
    const childrenOf = {};
    members.forEach(m => {
      childrenOf[m.id] = childrenOf[m.id] || [];
      if (m.parent_id && _nodeMap[m.parent_id]) {
        childrenOf[m.parent_id] = childrenOf[m.parent_id] || [];
        childrenOf[m.parent_id].push(m.id);
      }
    });

    // الجذور
    const roots = members.filter(m => !m.parent_id || !_nodeMap[m.parent_id]);

    const pos = {};
    let leafX = 0;

    // تعيين x بالترتيب (post-order)
    function assignX(id, depth) {
      const ch = childrenOf[id] || [];
      if (ch.length === 0) {
        pos[id] = { x: leafX * CFG.NODE_W + CFG.NODE_R, y: depth * CFG.LEV_H + CFG.NODE_R + 20, depth };
        leafX++;
      } else {
        ch.forEach(c => assignX(c, depth + 1));
        const fx = pos[ch[0]].x;
        const lx = pos[ch[ch.length - 1]].x;
        pos[id] = { x: (fx + lx) / 2, y: depth * CFG.LEV_H + CFG.NODE_R + 20, depth };
      }
    }

    roots.forEach(r => assignX(r.id, 0));

    // الأعضاء الأيتام
    members.forEach(m => {
      if (!pos[m.id]) {
        pos[m.id] = { x: leafX * CFG.NODE_W + CFG.NODE_R, y: CFG.NODE_R + 20, depth: 0 };
        leafX++;
      }
    });

    // إضافة لون الجيل
    Object.keys(pos).forEach(id => {
      pos[id].color = CFG.COLORS[pos[id].depth % CFG.COLORS.length];
    });

    return pos;
  }

  // ── رسم العقد ─────────────────────────────────────────────────────────────
  function _renderNodes(members, pos) {
    const div = getNodes();
    div.innerHTML = '';

    members.forEach(m => {
      const p = pos[m.id];
      if (!p) return;

      const el = document.createElement('div');
      el.className  = 'tree-node';
      el.dataset.id = m.id;

      // تمركز الدائرة على نقطة (x,y)
      el.style.left      = (p.x - CFG.NODE_R) + 'px';
      el.style.top       = (p.y - CFG.NODE_R) + 'px';
      el.style.width     = (CFG.NODE_R * 2) + 'px';
      el.style.height    = (CFG.NODE_R * 2) + 'px';
      el.style.borderColor = p.color;
      el.style.setProperty('--glow', p.color);

      // النص: حرفان أو ثلاثة من الاسم كـ Avatar
      const initials = m.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      el.innerHTML = `
        <div class="node-avatar" style="background:${p.color}22;color:${p.color}">${initials}</div>
        <div class="node-label">${m.name}</div>
      `;

      div.appendChild(el);
    });
  }

  // ── رسم الأغصان (SVG) ──────────────────────────────────────────────────────
  function _renderLinks(members, pos) {
    // نجمع كل الأبناء لكل أب
    const childrenOf = {};
    members.forEach(m => {
      if (!m.parent_id || !pos[m.parent_id] || !pos[m.id]) return;
      childrenOf[m.parent_id] = childrenOf[m.parent_id] || [];
      childrenOf[m.parent_id].push(m.id);
    });

    let paths = '';

    Object.keys(childrenOf).forEach(pid => {
      const children = childrenOf[pid];
      const pp = pos[pid];
      const color = pp.color;

      // نقطة البداية من أسفل الأب
      const startX = pp.x;
      const startY = pp.y + CFG.NODE_R;

      if (children.length === 1) {
        // ابن واحد — خط منحنٍ مباشر
        const cp = pos[children[0]];
        const endX = cp.x;
        const endY = cp.y - CFG.NODE_R;
        const midY = (startY + endY) / 2;
        paths += `<path class="tree-link" data-parent="${pid}" data-child="${children[0]}"
          stroke="${color}"
          d="M${startX},${startY} C${startX},${midY} ${endX},${midY} ${endX},${endY}"/>`;
      } else {
        // عدة أبناء — خط رأسي ثم عرضي ثم فروع
        const ys   = children.map(c => pos[c].y - CFG.NODE_R);
        const endY = ys[0];  // كلهم بنفس المستوى
        const jY   = startY + (endY - startY) * 0.45; // نقطة التفرع

        // الخط الرأسي من الأب للتفرع
        paths += `<line class="tree-link" data-parent="${pid}"
          stroke="${color}"
          x1="${startX}" y1="${startY}"
          x2="${startX}" y2="${jY}"/>`;

        // الخط الأفقي بين أول وآخر ابن
        const firstX = pos[children[0]].x;
        const lastX  = pos[children[children.length - 1]].x;
        paths += `<line class="tree-link" data-parent="${pid}"
          stroke="${color}"
          x1="${firstX}" y1="${jY}"
          x2="${lastX}"  y2="${jY}"/>`;

        // فرع عمودي لكل ابن
        children.forEach(cid => {
          const cp   = pos[cid];
          const endX = cp.x;
          const endY = cp.y - CFG.NODE_R;
          paths += `<line class="tree-link" data-parent="${pid}" data-child="${cid}"
            stroke="${color}"
            x1="${endX}" y1="${jY}"
            x2="${endX}" y2="${endY}"/>`;
        });
      }
    });

    getSvg().innerHTML = paths;
  }

  // ── ضبط حجم الـ canvas ───────────────────────────────────────────────────
  function _fitCanvas(pos) {
    let maxX = 0, maxY = 0;
    Object.values(pos).forEach(p => {
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    const w = maxX + CFG.NODE_R + 60;
    const h = maxY + CFG.NODE_R + 100;

    const svg = getSvg();
    svg.style.width  = w + 'px';
    svg.style.height = h + 'px';
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    getNodes().style.width  = w + 'px';
    getNodes().style.height = h + 'px';
    getWrapper().style.width  = w + 'px';
    getWrapper().style.height = h + 'px';
  }

  // ── Transform واحد على الـ wrapper ───────────────────────────────────────
  function _applyTransform() {
    getWrapper().style.transform =
      `translate(${_pan.x}px, ${_pan.y}px) scale(${_zoom})`;
  }

  // ── السحب والتكبير ────────────────────────────────────────────────────────
  function _initPanZoom() {
    const ct = getCt();

    // ماوس
    ct.addEventListener('mousedown', e => {
      if (e.target.closest('.tree-node')) return;
      _dragging  = true;
      _dragStart = { x: e.clientX, y: e.clientY, px: _pan.x, py: _pan.y };
      ct.classList.add('grabbing');
    });
    window.addEventListener('mousemove', e => {
      if (!_dragging) return;
      _pan.x = _dragStart.px + (e.clientX - _dragStart.x);
      _pan.y = _dragStart.py + (e.clientY - _dragStart.y);
      _applyTransform();
    });
    window.addEventListener('mouseup', () => {
      _dragging = false;
      ct.classList.remove('grabbing');
    });

    // لمس بإصبع واحد
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

    // عجلة الماوس
    ct.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = ct.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const d  = e.deltaY > 0 ? 0.9 : 1.1;
      const nz = Math.min(3, Math.max(0.15, _zoom * d));
      _pan.x = mx - (mx - _pan.x) * (nz / _zoom);
      _pan.y = my - (my - _pan.y) * (nz / _zoom);
      _zoom  = nz;
      _applyTransform();
    }, { passive: false });

    // pinch
    let iDist = 0, iZoom = 1, pCx = 0, pCy = 0;
    ct.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        iDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        iZoom = _zoom;
        const r = ct.getBoundingClientRect();
        pCx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
        pCy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
      }
    }, { passive: true });
    ct.addEventListener('touchmove', e => {
      if (e.touches.length !== 2) return;
      const d  = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const nz = Math.min(3, Math.max(0.15, iZoom * (d / iDist)));
      _pan.x = pCx - (pCx - _pan.x) * (nz / _zoom);
      _pan.y = pCy - (pCy - _pan.y) * (nz / _zoom);
      _zoom  = nz;
      _applyTransform();
    }, { passive: true });

    // ربط أزرار الأسفل
    const rBtn = document.getElementById('refreshBtn');
    const sBtn = document.getElementById('statsBtn');
    if (rBtn) rBtn.onclick = async () => {
      rBtn.textContent = '⏳';
      rBtn.disabled    = true;
      await App.reload();
      rBtn.textContent = '🔄 تحديث';
      rBtn.disabled    = false;
    };
    if (sBtn) sBtn.onclick = _showStats;
  }

  // ── التمركز على عقدة ─────────────────────────────────────────────────────
  function centreOnNode(id) {
    const p = _positions[id];
    if (!p) return;
    const ct = getCt();
    _zoom  = 1.4;
    _pan.x = ct.clientWidth  / 2 - p.x * _zoom;
    _pan.y = ct.clientHeight / 2 - p.y * _zoom;
    _applyTransform();
  }

  function centreOnRoot() {
    if (!_members.length) return;
    const root = _members.find(m => !m.parent_id || !_nodeMap[m.parent_id]) || _members[0];
    const p    = _positions[root.id];
    if (!p) return;
    const ct = getCt();
    _zoom  = 1;
    _pan.x = ct.clientWidth / 2 - p.x;
    _pan.y = 30;
    _applyTransform();
  }

  // ── تمييز العقد ───────────────────────────────────────────────────────────
  function highlight(id) {
    document.querySelectorAll('.tree-node.highlighted')
      .forEach(n => n.classList.remove('highlighted'));
    const el = document.querySelector(`.tree-node[data-id="${id}"]`);
    if (el) el.classList.add('highlighted');
  }

  // ── تمييز مسار الأصل ─────────────────────────────────────────────────────
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
      const el = document.querySelector(`.tree-node[data-id="${aid}"]`);
      if (el) el.classList.add('lineage-node');
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
    const top3 = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,3);

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
          ${top3.map(([n,c],i)=>`
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

  // ── العرض الكامل ─────────────────────────────────────────────────────────
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
  function getMembers()  { return _members;     }

  return {
    render,
    centreOnNode,
    centreOnRoot,
    highlight,
    highlightLineage,
    clearLineage,
    getMember,
    getMembers,
    initPanZoom: _initPanZoom,
  };
})();
