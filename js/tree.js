/**
 * tree.js — شجرة عائلة رادیالیة
 * ================================
 * D3.js radial tree: الجذر في المنتصف، الفروع تمتد يميناً ويساراً
 */

const Tree = (() => {

  let _members  = [];
  let _nodeMap  = {};
  let _svg      = null;   // D3 svg selection
  let _gMain    = null;   // الـ group الرئيسي القابل للتحريك

  // ── بناء الخريطة ──────────────────────────────────────────────────────────
  function _buildMap(members) {
    _nodeMap = {};
    members.forEach(m => (_nodeMap[m.id] = m));
  }

  // ── تحويل المصفوفة الخطية إلى هيكل هرمي لـ D3 ────────────────────────────
  function _buildHierarchy(members) {
    // الجذر
    const roots = members.filter(m => !m.parent_id || !_nodeMap[m.parent_id]);
    const root  = roots[0] || members[0];
    if (!root) return null;

    // بناء شجرة مرجعية
    const nodeById = {};
    members.forEach(m => {
      nodeById[m.id] = { id: m.id, name: m.name, data: m, children: [] };
    });

    members.forEach(m => {
      if (m.parent_id && nodeById[m.parent_id]) {
        nodeById[m.parent_id].children.push(nodeById[m.id]);
      }
    });

    return nodeById[root.id];
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  الرسم الرئيسي
  // ══════════════════════════════════════════════════════════════════════════
  function render(members) {
    _members = members;
    _buildMap(members);

    const container = document.getElementById('treeContainer');
    container.innerHTML = '';   // امسح كل شيء قديم

    const W = container.clientWidth  || window.innerWidth;
    const H = container.clientHeight || (window.innerHeight - 56);

    // ── D3 SVG ──
    _svg = d3.select('#treeContainer')
      .append('svg')
      .attr('width',  W)
      .attr('height', H)
      .style('display', 'block');

    // تعريف filter للظل
    const defs = _svg.append('defs');
    const filter = defs.append('filter').attr('id', 'shadow').attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%');
    filter.append('feDropShadow').attr('dx', 0).attr('dy', 2).attr('stdDeviation', 3).attr('flood-color', 'rgba(0,0,0,0.22)');

    // تدرج خشبي للبيضاويات
    const grad = defs.append('radialGradient')
      .attr('id', 'woodGrad')
      .attr('cx', '38%').attr('cy', '35%')
      .attr('r',  '65%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#d4b896');
    grad.append('stop').attr('offset', '40%').attr('stop-color', '#a07040');
    grad.append('stop').attr('offset', '75%').attr('stop-color', '#7a5020');
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#5c3010');

    // ── حاوية رئيسية قابلة للتحريك ──
    _gMain = _svg.append('g').attr('class', 'g-main');

    // ── بناء الهيكل الهرمي ──
    const hierarchyData = _buildHierarchy(members);
    if (!hierarchyData) return;

    const root = d3.hierarchy(hierarchyData, d => d.children.length ? d.children : null);

    // ── التخطيط الرادیالي ──
    // نصف قطر يعتمد على عدد العقد
    const nodeCount = root.descendants().length;
    // كلما زادت العقد، زاد النصف القطر
    const baseRadius = Math.min(W, H) * 0.42;
    const radius     = Math.max(baseRadius, nodeCount * 2.2);

    const treeLayout = d3.tree()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

    treeLayout(root);

    // ── رسم الأغصان ──
    const linkGroup = _gMain.append('g').attr('class', 'links-group');

    linkGroup.selectAll('path.tree-link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'tree-link')
      .attr('data-parent', d => d.source.data.id)
      .attr('data-child',  d => d.target.data.id)
      .attr('d', d3.linkRadial()
        .angle(d => d.x)
        .radius(d => d.y)
      );

    // ── رسم مجموعات العقد ──
    const nodeGroup = _gMain.append('g').attr('class', 'nodes-group');

    const node = nodeGroup.selectAll('g.tree-node-g')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'tree-node-g')
      .attr('data-id', d => d.data.id)
      .attr('transform', d => {
        const px = d.y * Math.cos(d.x - Math.PI / 2);
        const py = d.y * Math.sin(d.x - Math.PI / 2);
        return `translate(${px},${py})`;
      });

    // البيضاوية
    const OW = 68, OH = 28;
    node.append('ellipse')
      .attr('rx', OW / 2)
      .attr('ry', OH / 2)
      .attr('class', 'node-oval')
      .style('filter', 'url(#shadow)');

    // النص
    node.append('text')
      .attr('class', 'node-label')
      .attr('dy', '0.35em')
      .text(d => d.data.name);

    // منطقة نقر شفافة فوق كل شيء
    node.append('ellipse')
      .attr('rx', OW / 2 + 4)
      .attr('ry', OH / 2 + 4)
      .attr('class', 'node-hitbox')
      .on('click',     function(event, d) { _onNodeClick(event, d.data.id); })
      .on('touchend',  function(event, d) { event.preventDefault(); _onNodeClick(event, d.data.id); });

    // ── توسيط ومحاذاة ──
    _centerTree(W, H, root, radius);

    // ── تفعيل السحب والتكبير ──
    _initZoom(W, H);
    _attachButtons();
  }

  // ── توسيط الشجرة وملء الشاشة ─────────────────────────────────────────────
  function _centerTree(W, H, root, radius) {
    // حساب حدود الشجرة
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    root.descendants().forEach(d => {
      const px = d.y * Math.cos(d.x - Math.PI / 2);
      const py = d.y * Math.sin(d.x - Math.PI / 2);
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
    });

    const treeW = maxX - minX + 80;
    const treeH = maxY - minY + 80;

    // الزوم الذي يملأ الشاشة
    const scale = Math.min((W - 20) / treeW, (H - 20) / treeH, 1.5);

    // ترجمة لتمركز الشجرة
    const tx = W / 2 - ((minX + maxX) / 2) * scale;
    const ty = H / 2 - ((minY + maxY) / 2) * scale;

    _gMain.attr('transform', `translate(${tx},${ty}) scale(${scale})`);

    // حفظ التحويل الأولي لـ D3 zoom
    _initialTransform = d3.zoomIdentity.translate(tx, ty).scale(scale);
  }

  let _initialTransform = null;
  let _zoomBehavior     = null;

  // ── تفعيل السحب والتكبير بـ D3 ───────────────────────────────────────────
  function _initZoom(W, H) {
    _zoomBehavior = d3.zoom()
      .scaleExtent([0.05, 5])
      .on('zoom', (event) => {
        _gMain.attr('transform', event.transform);
      });

    _svg.call(_zoomBehavior);

    // تطبيق التحويل الأولي
    if (_initialTransform) {
      _svg.call(_zoomBehavior.transform, _initialTransform);
    }

    // منع النقر المزدوج من التكبير (يتعارض مع النقر على العقد)
    _svg.on('dblclick.zoom', null);
  }

  // ── حدث النقر على العقدة ─────────────────────────────────────────────────
  function _onNodeClick(event, nodeId) {
    event.stopPropagation();
    // أرسل الحدث للـ interactions.js
    const el = document.querySelector(`g.tree-node-g[data-id="${nodeId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      window._treeNodeClick && window._treeNodeClick(nodeId, cx, cy);
    }
  }

  // ── أزرار الأسفل ──────────────────────────────────────────────────────────
  function _attachButtons() {
    const rBtn = document.getElementById('refreshBtn');
    const sBtn = document.getElementById('statsBtn');
    if (rBtn) rBtn.onclick = async () => {
      rBtn.textContent = '⏳'; rBtn.disabled = true;
      await App.reload();
      rBtn.textContent = '🔄 تحديث'; rBtn.disabled = false;
    };
    if (sBtn) sBtn.onclick = _showStats;
  }

  // ── تمركز على عقدة ───────────────────────────────────────────────────────
  function centreOnNode(id) {
    const el = document.querySelector(`g.tree-node-g[data-id="${id}"]`);
    if (!el || !_svg || !_zoomBehavior) return;
    const ct = document.getElementById('treeContainer');
    const W  = ct.clientWidth, H = ct.clientHeight;

    // الحصول على موضع العقدة في مساحة SVG
    const transform = d3.zoomTransform(_svg.node());
    const bbox      = el.getBBox ? el.getBBox() : { x: 0, y: 0 };
    // cx, cy في مساحة SVG بعد transform
    const matrix = el.getScreenCTM();
    if (!matrix) return;
    const cx = matrix.e; const cy = matrix.f;

    const scale = 1.5;
    _svg.transition().duration(500)
      .call(_zoomBehavior.transform,
        d3.zoomIdentity
          .translate(W / 2 - cx, H / 2 - cy)
          .scale(scale)
      );
  }

  function centreOnRoot() {
    if (_initialTransform && _svg && _zoomBehavior) {
      _svg.transition().duration(400)
        .call(_zoomBehavior.transform, _initialTransform);
    }
  }

  // ── تمييز ─────────────────────────────────────────────────────────────────
  function highlight(id) {
    d3.selectAll('g.tree-node-g').classed('highlighted', false);
    d3.select(`g.tree-node-g[data-id="${id}"]`).classed('highlighted', true);
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
    ancs.forEach(aid => {
      d3.select(`g.tree-node-g[data-id="${aid}"]`).classed('lineage-node', true);
    });
    d3.selectAll('path.tree-link').each(function(d) {
      if (ancs.has(d.source.data.id) && ancs.has(d.target.data.id)) {
        d3.select(this).classed('lineage-link', true);
      }
    });
    return ancs;
  }

  function clearLineage() {
    d3.selectAll('.lineage-node').classed('lineage-node', false);
    d3.selectAll('.lineage-link').classed('lineage-link', false);
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
    bd.addEventListener('click', e => { if(e.target===bd) bd.remove(); });
  }

  function getMember(id) { return _nodeMap[id]; }
  function getMembers()  { return _members; }

  // initPanZoom لا يفعل شيئاً هنا (D3 يتولى كل شيء في render)
  function initPanZoom() {}

  return {
    render, centreOnNode, centreOnRoot,
    highlight, highlightLineage, clearLineage,
    getMember, getMembers, initPanZoom,
  };
})();
