/**
 * tree.js — شجرة العائلة الاحترافية
 * الميزات: توزيع واقعي، جذع متدرج السماكة، دعم اللمس والسحب، بحث وإحصائيات.
 */

const Tree = (() => {

  // ── إعدادات التصميم الشجري ────────────────────────────────────────────────
  const LEAF_W = 90;    // عرض الورقة
  const LEAF_H = 45;    // ارتفاع الورقة
  const H_GAP  = 20;    // المسافة الأفقية بين الأوراق
  const V_GAP  = 100;   // المسافة الرأسية بين الأجيال (طول الغصن)

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

  // ── بناء خريطة البيانات ──────────────────────────────────────────────────
  function _buildMap(members) {
    _nodeMap = {};
    members.forEach(m => (_nodeMap[m.id] = m));
  }

  function _buildChildMap() {
    const ch = {};
    _members.forEach(m => {
      ch[m.id] = ch[m.id] || [];
      if (m.parent_id && _nodeMap[m.parent_id]) {
        ch[m.parent_id].push(m.id);
      }
    });
    return ch;
  }

  // حساب عمق كل فرد (الأجداد في الأسفل 0)
  function _calcDepths(childMap) {
    const depths = {};
    const roots = _members.filter(m => !m.parent_id || !_nodeMap[m.parent_id]);
    
    function walk(id, d) {
      depths[id] = d;
      (childMap[id] || []).forEach(cid => walk(cid, d + 1));
    }
    roots.forEach(r => walk(r.id, 0));
    _members.forEach(m => { if (depths[m.id] === undefined) depths[m.id] = 0; });
    return depths;
  }

  // ── حساب المواقع (تخطيط شجري واقعي) ───────────────────────────────────────
  function _layout() {
    const childMap = _buildChildMap();
    const depths   = _calcDepths(childMap);
    const maxD     = Math.max(...Object.values(depths), 0);
    
    const rawX = {};
    let leafIdx = 0;

    // توزيع العناصر أفقياً بناءً على تفرع الأبناء
    function assignX(id) {
      const ch = childMap[id] || [];
      if (ch.length === 0) {
        rawX[id] = leafIdx++;
      } else {
        ch.forEach(assignX);
        rawX[id] = (rawX[ch[0]] + rawX[ch[ch.length-1]]) / 2;
      }
    }
    _members.filter(m => !m.parent_id || !_nodeMap[m.parent_id]).forEach(r => assignX(r.id));

    const pos = {};
    _members.forEach(m => {
      const d = depths[m.id];
      pos[m.id] = {
        x: rawX[m.id] * (LEAF_W + H_GAP),
        // الأجداد في الأسفل، الأبناء للأعلى
        y: (maxD - d) * (LEAF_H + V_GAP),
        depth: d
      };
    });

    return { pos, childMap, maxD, leafCount: leafIdx };
  }

  // ── الرسم (الأوراق والأغصان) ──────────────────────────────────────────────
  function _renderNodes(pos) {
    const div = getNd();
    div.innerHTML = '';
    _members.forEach(m => {
      const p = pos[m.id];
      const el = document.createElement('div');
      el.className = 'tree-node leaf';
      el.dataset.id = m.id;
      el.style.left = (p.x - LEAF_W/2) + 'px';
      el.style.top  = (p.y - LEAF_H/2) + 'px';
      el.innerHTML = `<span class="leaf-text">${m.name}</span>`;
      div.appendChild(el);
    });
  }

  function _renderLinks(layout) {
    const { pos, childMap } = layout;
    let svgContent = '';

    // حساب "وزن" كل غصن (كم شخص يتبعه) لتحديد السمك
    const weight = {};
    function getW(id) {
      if (weight[id]) return weight[id];
      const ch = childMap[id] || [];
      return weight[id] = 1 + ch.reduce((sum, cid) => sum + getW(cid), 0);
    }

    Object.keys(childMap).forEach(pid => {
      const pp = pos[pid];
      childMap[pid].forEach(cid => {
        const cp = pos[cid];
        const w = getW(cid);
        
        // حساب سماكة الجذع/الغصن بناءً على النسل
        const strokeW = Math.min(40, Math.max(3, w * 1.8));
        const color = strokeW > 15 ? '#4a2c10' : '#6b4423'; // الجذع أغمق

        // رسم غصن منحني (Cubic Bezier)
        const dy = cp.y - pp.y;
        const dPath = `M ${pp.x} ${pp.y} C ${pp.x} ${pp.y + dy*0.5}, ${cp.x} ${cp.y - dy*0.5}, ${cp.x} ${cp.y}`;
        
        svgContent += `<path class="tree-branch" d="${dPath}" stroke="${color}" stroke-width="${strokeW}" fill="none" />`;
      });
    });
    getSvg().innerHTML = svgContent;
  }

  // ── نظام التحكم (سحب، زووم، وتوسيط) ──────────────────────────────────────
  function _autoFit(layout) {
    const ct = getCt();
    const tw = layout.leafCount * (LEAF_W + H_GAP);
    const th = (layout.maxD + 1) * (LEAF_H + V_GAP);
    
    _zoom = Math.min(ct.clientWidth / (tw + 100), ct.clientHeight / (th + 100), 1);
    _pan.x = ct.clientWidth / 2 - (tw / 2) * _zoom;
    _pan.y = ct.clientHeight - 50; // البداية من الأسفل
    _applyTransform();
  }

  function _applyTransform() {
    getWr().style.transform = `translate(${_pan.x}px, ${_pan.y}px) scale(${_zoom})`;
  }

  function _initPanZoom() {
    const ct = getCt();
    // السحب بالماوس
    ct.onmousedown = e => {
      if (e.target.closest('.tree-node')) return;
      _dragging = true;
      _ds = { x: e.clientX - _pan.x, y: e.clientY - _pan.y };
      ct.style.cursor = 'grabbing';
    };
    window.onmousemove = e => {
      if (!_dragging) return;
      _pan.x = e.clientX - _ds.x;
      _pan.y = e.clientY - _ds.y;
      _applyTransform();
    };
    window.onmouseup = () => { _dragging = false; ct.style.cursor = 'grab'; };

    // الزووم بالعجلة
    ct.onwheel = e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      _zoom = Math.min(3, Math.max(0.1, _zoom * delta));
      _applyTransform();
    };
  }

  // ── الوظائف العامة ───────────────────────────────────────────────────────
  function render(members) {
    _members = members;
    _buildMap(members);
    const layout = _layout();
    _positions = layout.pos;
    
    // ضبط حجم الـ SVG
    const tw = layout.leafCount * (LEAF_W + H_GAP) + 500;
    getSvg().setAttribute('viewBox', `-${tw/2} -1000 ${tw} 2000`);
    
    _renderNodes(layout.pos);
    _renderLinks(layout);
    _autoFit(layout);
    _initPanZoom();
  }

  // دالة الإحصائيات
  function showStats() {
    const total = _members.length;
    alert(`إحصائيات الشجرة:\nعدد أفراد العائلة: ${total}\nتم التصميم بواسطة فضل عباس`);
  }

  return { render, showStats };
})();
