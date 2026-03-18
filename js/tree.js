/**
 * tree.js — شجرة العائلة
 * الجذر أسفل، الأبناء أعلى، تملأ الشاشة تلقائياً
 */

const Tree = (() => {

  // ── ثوابت التصميم ─────────────────────────────────────────────────────────
  const OW     = 82;   // عرض البيضاوية
  const OH     = 34;   // ارتفاع البيضاوية
  const H_GAP  = 14;   // مسافة أفقية بين العقد
  const V_GAP  = 70;   // مسافة رأسية بين الأجيال

  let _members   = [];
  let _nodeMap   = {};
  let _positions = {};
  let _pan       = { x: 0, y: 0 };
  let _zoom      = 1;
  let _dragging  = false;
  let _ds        = {};

  const getCt  = () => document.getElementById('treeContainer');
  const getWr  = () => document.getElementById('treeWrapper');
  const getNd  = () => document.getElementById('nodesContainer');
  const getSvg = () => document.getElementById('linksSvg');

  // ── بناء الخرائط ──────────────────────────────────────────────────────────
  function _buildMap(members) {
    _nodeMap = {};
    members.forEach(m => (_nodeMap[m.id] = m));
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

  // ── حساب العمق (BFS من الجذور) ────────────────────────────────────────────
  function _calcDepths(childMap) {
    const depths = {};
    _members.forEach(m => {
      if (!m.parent_id || !_nodeMap[m.parent_id]) depths[m.id] = 0;
    });
    const queue = Object.keys(depths);
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      (childMap[id] || []).forEach(cid => {
        depths[cid] = depths[id] + 1;
        queue.push(cid);
      });
    }
    _members.forEach(m => { if (depths[m.id] === undefined) depths[m.id] = 0; });
    return depths;
  }

  // ── تخطيط الشجرة ──────────────────────────────────────────────────────────
  function _layout() {
    const childMap = _buildChildMap();
    const depths   = _calcDepths(childMap);
    const maxDepth = Math.max(...Object.values(depths), 0);

    // الجذور
    const roots = _members.filter(m => !m.parent_id || !_nodeMap[m.parent_id]);

    // post-order: تعيين موضع X للأوراق أولاً
    const rawPos = {};
    let leafCounter = 0;

    function assignX(id) {
      const ch = childMap[id] || [];
      if (ch.length === 0) {
        rawPos[id] = leafCounter++;
      } else {
        ch.forEach(c => assignX(c));
        rawPos[id] = (rawPos[ch[0]] + rawPos[ch[ch.length - 1]]) / 2;
      }
    }
    roots.forEach(r => assignX(r.id));
    _members.forEach(m => { if (rawPos[m.id] === undefined) { rawPos[m.id] = leafCounter++; } });

    const unit = OW + H_GAP;

    // تحويل إلى إحداثيات
    const pos = {};
    _members.forEach(m => {
      const d = depths[m.id];
      pos[m.id] = {
        x:     rawPos[m.id] * unit + OW / 2,
        // الجذر (d=0) في أسفل، الأوراق (d=maxDepth) في أعلى
        y:     (maxDepth - d) * (OH + V_GAP) + OH / 2,
        depth: d,
      };
    });

    return { pos, maxDepth, leafCount: leafCounter };
  }

  // ── حساب الزوم التلقائي ليملأ الشاشة ──────────────────────────────────────
  function _autoFit(pos, leafCount, maxDepth) {
    const ct = getCt();
    const screenW = ct.clientWidth;
    const screenH = ct.clientHeight;

    // حجم الشجرة الكاملة
    const treeW = leafCount  * (OW + H_GAP) - H_GAP + OW;
    const treeH = (maxDepth + 1) * (OH + V_GAP);

    // الزوم الذي يجعل الشجرة تملأ الشاشة مع هامش صغير
    const zoomX = (screenW - 20) / treeW;
    const zoomY = (screenH - 30) / treeH;
    _zoom = Math.min(zoomX, zoomY, 1.5);

    // توسيط أفقي
    _pan.x = (screenW - treeW * _zoom) / 2;
    // الجذر في الأسفل
    _pan.y = screenH - (treeH * _zoom) - 10;
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

      el.innerHTML = `<span class="node-text">${m.name}</span>`;
      div.appendChild(el);
    });
  }

  // ── رسم الأغصان ───────────────────────────────────────────────────────────
  function _renderLinks(pos) {
    const childMap = _buildChildMap();
    let svg = '';

    Object.keys(childMap).forEach(pid => {
      const pp = pos[pid];
      if (!pp) return;

      const children = childMap[pid];

      // نقطة خروج: أعلى البيضاوية للأب
      const sx = pp.x;
      const sy = pp.y - OH / 2;

      children.forEach(cid => {
        const cp = pos[cid];
        if (!cp) return;

        // نقطة وصول: أسفل بيضاوية الابن
        const ex = cp.x;
        const ey = cp.y + OH / 2;

        // منحنى طبيعي
        const dy  = Math.abs(sy - ey);
        const c1y = sy - dy * 0.4;
        const c2y = ey + dy * 0.4;

        svg += `<path
          class="tree-link"
          data-parent="${pid}"
          data-child="${cid}"
          d="M${sx},${sy} C${sx},${c1y} ${ex},${c2y} ${ex},${ey}"
        />`;
      });
    });

    getSvg().innerHTML = svg;
  }

  // ── ضبط حجم الـ canvas ───────────────────────────────────────────────────
  function _fitCanvas(pos) {
    let maxX = 0, maxY = 0;
    Object.values(pos).forEach(p => {
      if (p.x + OW / 2 > maxX) maxX = p.x + OW / 2;
      if (p.y + OH / 2 > maxY) maxY = p.y + OH / 2;
    });
    const w = maxX + 20;
    const h = maxY + 20;

    const svg = getSvg();
    svg.style.width  = w + 'px';
    svg.style.height = h + 'px';
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    getNd().style.width    = w + 'px';
    getNd().style.height   = h + 'px';
    getWr().style.width    = w + 'px';
    getWr().style.height   = h + 'px';
  }

  // ── transform ─────────────────────────────────────────────────────────────
  function _applyTransform() {
    getWr().style.transform = `translate(${_pan.x}px,${_pan.y}px) scale(${_zoom})`;
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
    window.addEventListener('mouseup', () => { _dragging = false; ct.classList.remove('grabbing'); });

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
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const d  = e.deltaY > 0 ? 0.9 : 1.1;
      const nz = Math.min(4, Math.max(0.1, _zoom * d));
      _pan.x = mx - (mx - _pan.x) * (nz / _zoom);
      _pan.y = my - (my - _pan.y) * (nz / _zoom);
      _zoom  = nz; _applyTransform();
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
      const nz = Math.min(4, Math.max(0.1, iZ * (d / iD)));
      _pan.x = pcx - (pcx - _pan.x) * (nz / _zoom);
      _pan.y = pcy - (pcy - _pan.y) * (nz / _zoom);
      _zoom  = nz; _applyTransform();
    }, { passive: true });

    const rBtn = document.getElementById('refreshBtn');
    const sBtn = document.getElementById('statsBtn');
    if (rBtn) rBtn.onclick = async () => {
      rBtn.textContent = '⏳'; rBtn.disabled = true;
      await App.reload();
      rBtn.textContent = '🔄 تحديث'; rBtn.disabled = false;
    };
    if (sBtn) sBtn.onclick = _showStats;
  }

  // ── عرض للجذر ─────────────────────────────────────────────────────────────
  function centreOnRoot() {
    if (!_members.length) return;
    const { pos, leafCount, maxDepth } = _lastLayout;
    _autoFit(pos, leafCount, maxDepth);
    _applyTransform();
  }

  function centreOnNode(id) {
    const p = _positions[id];
    if (!p) return;
    const ct = getCt();
    _zoom  = 1.5;
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
    ancs.forEach(aid => document.querySelector(`.tree-node[data-id="${aid}"]`)?.classList.add('lineage-node'));
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
      <button class="stats-close" id="statsClose">✕</button>
      <div class="stats-icon">📊</div>
      <h2 class="stats-title">إحصائيات الشجرة</h2>
      <div class="stats-total"><span class="stats-total-num">${total}</span><span class="stats-total-label">فرد في الشجرة</span></div>
      <div class="stats-section-title">أكثر الأسماء تكراراً</div>
      <div class="stats-names">${top3.map(([n,c],i)=>`<div class="stats-name-row"><span class="stats-rank">${['🥇','🥈','🥉'][i]}</span><span class="stats-name">${n}</span><span class="stats-count">${c} مرة</span></div>`).join('')}</div>
      <div class="stats-credit">تم إنشاء هذا البرنامج من قبل<br/><strong>فضل عباس زينل</strong><br/><a href="tel:07501377753" class="stats-phone">📞 07501377753</a></div>
    </div>`;
    document.body.appendChild(bd);
    document.getElementById('statsClose').onclick = () => bd.remove();
    bd.addEventListener('click', e => { if(e.target===bd) bd.remove(); });
  }

  // ── العرض الكامل ──────────────────────────────────────────────────────────
  let _lastLayout = null;

  function render(members) {
    _members = members;
    _buildMap(members);
    const layout = _layout();
    _lastLayout  = layout;
    _positions   = layout.pos;
    _renderNodes(layout.pos);
    _renderLinks(layout.pos);
    _fitCanvas(layout.pos);
    // انتظر ريندر DOM ثم اضبط الزوم
    requestAnimationFrame(() => {
      _autoFit(layout.pos, layout.leafCount, layout.maxDepth);
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
