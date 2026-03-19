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
