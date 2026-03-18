/**
 * tree.js — شجرة العائلة
 * ======================
 * التصميم:
 *  - الجذر في المنتصف أسفل الشاشة
 *  - أبناء كل شخص يتوزعون يميناً ويساراً بالتساوي
 *  - الشجرة تملأ الشاشة تلقائياً عند الفتح
 *  - أغصان منحنية طبيعية
 */

const Tree = (() => {

  // ── أبعاد العقدة ──────────────────────────────────────────────────────────
  const OW    = 78;   // عرض البيضاوية
  const OH    = 34;   // ارتفاع البيضاوية
  const HGAP  = 10;   // مسافة أفقية بين الأخوة
  const VGAP  = 75;   // مسافة رأسية بين الأجيال

  let _members  = [];
  let _nodeMap  = {};
  let _pos      = {};   // id → {x, y}
  let _pan      = { x: 0, y: 0 };
  let _zoom     = 1;
  let _drag     = false;
  let _ds       = {};
  let _lastW    = 0;   // عرض الشجرة الكاملة (لحساب الملء)
  let _lastH    = 0;

  const getCt  = () => document.getElementById('treeContainer');
  const getWr  = () => document.getElementById('treeWrapper');
  const getNd  = () => document.getElementById('nodesContainer');
  const getSvg = () => document.getElementById('linksSvg');

  // ── بناء الخرائط ──────────────────────────────────────────────────────────
  function _buildMap() {
    _nodeMap = {};
    _members.forEach(m => (_nodeMap[m.id] = m));
  }

  function _buildChildMap() {
    const ch = {};
    _members.forEach(m => {
      ch[m.id] = ch[m.id] || [];
      if (m.parent_id && _nodeMap[m.parent_id]) {
        ch[m.parent_id] = ch[m.parent_id] || [];
        ch[m.parent_id].push(m.id);
      }
    });
    return ch;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  التخطيط المتوازن:
  //  - أبناء كل أب يُوزَّعون يميناً ويساراً بالتساوي
  //  - كل شجرة فرعية لها عرض حسب عدد أوراقها
  //  - الأب في المنتصف بين أبنائه
  // ══════════════════════════════════════════════════════════════════════════
  function _layout(childMap) {
    // ── حساب عمق كل عقدة ──
    const depth = {};
    _members.forEach(m => {
      if (!m.parent_id || !_nodeMap[m.parent_id]) depth[m.id] = 0;
    });
    const bfsQ = Object.keys(depth).slice();
    for (let i = 0; i < bfsQ.length; i++) {
      (childMap[bfsQ[i]] || []).forEach(c => {
        depth[c] = depth[bfsQ[i]] + 1;
        bfsQ.push(c);
      });
    }
    _members.forEach(m => { if (depth[m.id] === undefined) depth[m.id] = 0; });

    const maxDepth = Math.max(...Object.values(depth), 0);

    // ── حساب عرض كل شجرة فرعية (عدد الأوراق) ──
    const leafCount = {};
    function calcLeaves(id) {
      const ch = childMap[id] || [];
      if (ch.length === 0) { leafCount[id] = 1; return 1; }
      let s = 0;
      ch.forEach(c => { s += calcLeaves(c); });
      leafCount[id] = s;
      return s;
    }
    _members.filter(m => depth[m.id] === 0).forEach(r => calcLeaves(r.id));
    _members.forEach(m => { if (!leafCount[m.id]) leafCount[m.id] = 1; });

    const unit = OW + HGAP;

    // ── تعيين X لكل عقدة ──
    // كل أب يضع أبناءه بحيث مجموعهم متمركز حوله
    const xPos = {};

    function placeSubtree(id, centerX) {
      xPos[id] = centerX;
      const ch = childMap[id] || [];
      if (ch.length === 0) return;

      // إجمالي عرض الأبناء
      const totalWidth = ch.reduce((s, c) => s + leafCount[c] * unit, 0) - HGAP;

      // بداية الابن الأول (يسار المجموعة)
      let curX = centerX - totalWidth / 2;

      ch.forEach(c => {
        const cw = leafCount[c] * unit - HGAP;
        placeSubtree(c, curX + cw / 2);
        curX += leafCount[c] * unit;
      });
    }

    // الجذور
    const roots = _members.filter(m => depth[m.id] === 0);
    const totalRootWidth = roots.reduce((s, r) => s + leafCount[r.id] * unit, 0);
    let rootX = totalRootWidth / 2;

    roots.forEach(r => {
      const rw = leafCount[r.id] * unit;
      placeSubtree(r.id, rootX - totalRootWidth / 2 + rw / 2);
      rootX += rw;
    });

    // أعضاء بدون موضع
    let orphanX = totalRootWidth + unit;
    _members.forEach(m => { if (xPos[m.id] === undefined) { xPos[m.id] = orphanX; orphanX += unit; } });

    // ── تحويل إلى إحداثيات Y (الجذر أسفل) ──
    const pos = {};
    _members.forEach(m => {
      const d = depth[m.id];
      pos[m.id] = {
        x: xPos[m.id],
        y: (maxDepth - d) * (OH + VGAP) + OH / 2,
      };
    });

    // حجم الـ canvas
    let maxX = 0, maxY = 0;
    Object.values(pos).forEach(p => {
      if (p.x + OW / 2 > maxX) maxX = p.x + OW / 2;
      if (p.y + OH / 2 > maxY) maxY = p.y + OH / 2;
    });

    return { pos, w: maxX + 20, h: maxY + 20, rootIds: roots.map(r => r.id) };
  }

  // ── رسم العقد ─────────────────────────────────────────────────────────────
  function _renderNodes(pos) {
    const div = getNd();
    div.innerHTML = '';
    _members.forEach(m => {
      const p = pos[m.id];
      if (!p) return;
      const el = document.createElement('div');
      el.className  = 'tree-node';
      el.dataset.id = m.id;
      el.style.left   = (p.x - OW / 2) + 'px';
      el.style.top    = (p.y - OH / 2) + 'px';
      el.style.width  = OW + 'px';
      el.style.height = OH + 'px';
      el.innerHTML    = `<span class="node-text">${m.name}</span>`;
      div.appendChild(el);
    });
  }

  // ── رسم الأغصان ───────────────────────────────────────────────────────────
  function _renderLinks(pos, childMap) {
    let svg = '';
    Object.keys(childMap).forEach(pid => {
      const pp = pos[pid];
      if (!pp) return;
      childMap[pid].forEach(cid => {
        const cp = pos[cid];
        if (!cp) return;
        // الأب: من أعلى البيضاوية (لأن الأبناء فوقه)
        const sx = pp.x, sy = pp.y - OH / 2;
        // الابن: إلى أسفل بيضاويته
        const ex = cp.x, ey = cp.y + OH / 2;
        const dy = Math.abs(sy - ey);
        svg += `<path class="tree-link"
          data-parent="${pid}" data-child="${cid}"
          d="M${sx},${sy} C${sx},${sy - dy*0.4} ${ex},${ey + dy*0.4} ${ex},${ey}"
        />`;
      });
    });
    getSvg().innerHTML = svg;
  }

  // ── ضبط حجم الـ canvas ────────────────────────────────────────────────────
  function _fitCanvas(w, h) {
    const svg = getSvg();
    svg.style.width  = w + 'px';
    svg.style.height = h + 'px';
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    getNd().style.width    = w + 'px';
    getNd().style.height   = h + 'px';
    getWr().style.width    = w + 'px';
    getWr().style.height   = h + 'px';
  }

  // ── ملء الشاشة تلقائياً ───────────────────────────────────────────────────
  // الجذر في المنتصف أسفل الشاشة، الشجرة تملأ الشاشة
  function _autoFit(w, h, pos, rootIds) {
    const ct = getCt();
    const sw = ct.clientWidth;
    const sh = ct.clientHeight;

    // الزوم الذي يجعل الشجرة تملأ الشاشة
    const zx = (sw - 16) / w;
    const zy = (sh - 20) / h;
    _zoom = Math.min(zx, zy, 2);

    // موضع الجذر الأول بعد التحويل
    const rootPos = rootIds.length > 0 ? pos[rootIds[0]] : null;

    if (rootPos) {
      // الجذر يظهر في المنتصف أفقياً وفي الأسفل
      _pan.x = sw / 2 - rootPos.x * _zoom;
      _pan.y = sh - (rootPos.y + OH / 2) * _zoom - 8;
    } else {
      _pan.x = (sw - w * _zoom) / 2;
      _pan.y = sh - h * _zoom - 8;
    }
  }

  // ── transform ─────────────────────────────────────────────────────────────
  function _applyTransform() {
    getWr().style.transform = `translate(${_pan.x}px,${_pan.y}px) scale(${_zoom})`;
  }

  // ── السحب والتكبير ────────────────────────────────────────────────────────
  function _initPanZoom() {
    const ct = getCt();

    // ماوس
    ct.addEventListener('mousedown', e => {
      if (e.target.closest('.tree-node')) return;
      _drag = true; _ds = { x: e.clientX, y: e.clientY, px: _pan.x, py: _pan.y };
      ct.classList.add('grabbing');
    });
    window.addEventListener('mousemove', e => {
      if (!_drag) return;
      _pan.x = _ds.px + (e.clientX - _ds.x);
      _pan.y = _ds.py + (e.clientY - _ds.y);
      _applyTransform();
    });
    window.addEventListener('mouseup', () => { _drag = false; ct.classList.remove('grabbing'); });

    // لمس إصبع واحد
    let t0 = null;
    ct.addEventListener('touchstart', e => {
      if (e.touches.length === 1 && !e.target.closest('.tree-node'))
        t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: _pan.x, py: _pan.y };
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
      const r  = ct.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const nz = Math.min(4, Math.max(0.08, _zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      _pan.x = mx - (mx - _pan.x) * (nz / _zoom);
      _pan.y = my - (my - _pan.y) * (nz / _zoom);
      _zoom  = nz; _applyTransform();
    }, { passive: false });

    // pinch
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
      const nz = Math.min(4, Math.max(0.08, iZ * (d / iD)));
      _pan.x = pcx - (pcx - _pan.x) * (nz / _zoom); _pan.y = pcy - (pcy - _pan.y) * (nz / _zoom);
      _zoom  = nz; _applyTransform();
    }, { passive: true });

    // أزرار الأسفل
    const rBtn = document.getElementById('refreshBtn');
    const sBtn = document.getElementById('statsBtn');
    if (rBtn) rBtn.onclick = async () => {
      rBtn.textContent = '⏳'; rBtn.disabled = true;
      await App.reload();
      rBtn.textContent = '🔄 تحديث'; rBtn.disabled = false;
    };
    if (sBtn) sBtn.onclick = _showStats;
  }

  // ── تمركز على الجذر ───────────────────────────────────────────────────────
  function centreOnRoot() {
    if (!_lastLayout) return;
    const { pos, w, h, rootIds } = _lastLayout;
    _autoFit(w, h, pos, rootIds);
    _applyTransform();
  }

  function centreOnNode(id) {
    const p = _pos[id]; if (!p) return;
    const ct = getCt();
    _zoom  = 1.6;
    _pan.x = ct.clientWidth  / 2 - p.x * _zoom;
    _pan.y = ct.clientHeight / 2 - p.y * _zoom;
    _applyTransform();
  }

  // ── تمييز ─────────────────────────────────────────────────────────────────
  function highlight(id) {
    document.querySelectorAll('.tree-node.highlighted').forEach(n => n.classList.remove('highlighted'));
    document.querySelector(`.tree-node[data-id="${id}"]`)?.classList.add('highlighted');
  }

  function highlightLineage(id) {
    clearLineage();
    const ancs = new Set();
    let cur = id;
    while (cur) {
      ancs.add(cur);
      const m = _nodeMap[cur];
      cur = m?.parent_id && _nodeMap[m.parent_id] ? m.parent_id : null;
    }
    ancs.forEach(a => document.querySelector(`.tree-node[data-id="${a}"]`)?.classList.add('lineage-node'));
    document.querySelectorAll('.tree-link').forEach(p => {
      if (ancs.has(p.dataset.child) && ancs.has(p.dataset.parent)) p.classList.add('lineage-link');
    });
    return ancs;
  }

  function clearLineage() {
    document.querySelectorAll('.lineage-node').forEach(n => n.classList.remove('lineage-node'));
    document.querySelectorAll('.lineage-link').forEach(p => p.classList.remove('lineage-link'));
  }

  // ── إحصائيات ──────────────────────────────────────────────────────────────
  function _showStats() {
    const total = _members.length;
    const freq  = {};
    _members.forEach(m => { const w = (m.name||'').split(/\s+/)[0]; if(w) freq[w]=(freq[w]||0)+1; });
    const top3  = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3);
    const bd = document.createElement('div');
    bd.className = 'stats-backdrop';
    bd.innerHTML = `<div class="stats-box">
      <button class="stats-close" id="sc">✕</button>
      <div class="stats-icon">📊</div>
      <h2 class="stats-title">إحصائيات الشجرة</h2>
      <div class="stats-total"><span class="stats-total-num">${total}</span><span class="stats-total-label">فرد في الشجرة</span></div>
      <div class="stats-section-title">أكثر الأسماء تكراراً</div>
      <div class="stats-names">${top3.map(([n,c],i)=>`<div class="stats-name-row"><span class="stats-rank">${['🥇','🥈','🥉'][i]}</span><span class="stats-name">${n}</span><span class="stats-count">${c} مرة</span></div>`).join('')}</div>
      <div class="stats-credit">تم إنشاء هذا البرنامج من قبل<br/><strong>فضل عباس زينل</strong><br/><a href="tel:07501377753" class="stats-phone">📞 07501377753</a></div>
    </div>`;
    document.body.appendChild(bd);
    document.getElementById('sc').onclick = () => bd.remove();
    bd.addEventListener('click', e => { if (e.target === bd) bd.remove(); });
  }

  // ── العرض الكامل ──────────────────────────────────────────────────────────
  let _lastLayout = null;

  function render(members) {
    _members = members;
    _buildMap();
    const childMap   = _buildChildMap();
    const layout     = _layout(childMap);
    _lastLayout      = layout;
    _pos             = layout.pos;
    _renderNodes(layout.pos);
    _renderLinks(layout.pos, childMap);
    _fitCanvas(layout.w, layout.h);
    requestAnimationFrame(() => {
      _autoFit(layout.w, layout.h, layout.pos, layout.rootIds);
      _applyTransform();
    });
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
