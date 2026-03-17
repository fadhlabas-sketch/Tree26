/**
 * search.js
 * =========
 * بحث بجزء من الاسم أو الاسم كاملاً (1 أو 2 أو 3 أجزاء)
 */

const Search = (() => {

  const getInput   = () => document.getElementById('searchInput');
  const getBtn     = () => document.getElementById('searchBtn');
  const getResults = () => document.getElementById('searchResults');

  // تطبيع النص للمقارنة
  function _norm(s) {
    return (s || '').trim().toLowerCase()
      .replace(/[أإآ]/g, 'ا')   // توحيد الألف
      .replace(/ة/g, 'ه')       // توحيد التاء المربوطة
      .replace(/ى/g, 'ي')       // توحيد الياء
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // حساب درجة التطابق
  function _score(member, parts) {
    const name  = _norm(member.name);
    const words = name.split(/\s+/);
    let score = 0;

    parts.forEach(p => {
      if (name === p)            score += 100;
      else if (name.startsWith(p)) score += 60;
      else if (name.includes(p))   score += 30;
      words.forEach(w => {
        if (w === p)             score += 20;
        else if (w.startsWith(p)) score += 10;
      });
    });
    return score;
  }

  // تنفيذ البحث
  function _doSearch() {
    const raw = getInput().value.trim();
    if (!raw) { _hideResults(); return; }

    const parts   = _norm(raw).split(/\s+/).filter(Boolean);
    const members = Tree.getMembers();

    const scored = members
      .map(m => ({ m, score: _score(m, parts) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    if (scored.length === 0) {
      _showResults([{ label: 'لا توجد نتائج', sub: '', id: null }]);
      return;
    }

    if (scored.length === 1) {
      _selectMember(scored[0].m.id);
      _hideResults();
      return;
    }

    _showResults(scored.map(x => ({
      label: x.m.name,
      sub:   [x.m.birth_date, x.m.job].filter(Boolean).join(' · '),
      id:    x.m.id,
    })));
  }

  function _showResults(items) {
    const el = getResults();
    el.innerHTML = items.map(item => `
      <div class="search-result-item" tabindex="0" data-id="${item.id || ''}">
        <div>${item.label}</div>
        ${item.sub ? `<div class="search-result-sub">${item.sub}</div>` : ''}
      </div>
    `).join('');

    el.querySelectorAll('[data-id]').forEach(row => {
      const handler = () => {
        const id = row.dataset.id;
        if (id) _selectMember(id);
        _hideResults();
        getInput().value = row.querySelector('div').textContent;
      };
      row.addEventListener('click', handler);
      row.addEventListener('keydown', e => { if (e.key === 'Enter') handler(); });
    });

    el.classList.add('open');
  }

  function _hideResults() {
    getResults().classList.remove('open');
    getResults().innerHTML = '';
  }

  function _selectMember(id) {
    Tree.centreOnNode(id);
    Tree.highlight(id);
  }

  function init() {
    let timer;

    getInput().addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(_doSearch, 280);
    });

    getInput().addEventListener('keydown', e => {
      if (e.key === 'Enter')  { clearTimeout(timer); _doSearch(); }
      if (e.key === 'Escape') _hideResults();
    });

    getBtn().addEventListener('click', _doSearch);

    document.addEventListener('mousedown', e => {
      if (!e.target.closest('.search-wrapper')) _hideResults();
    });
  }

  return { init };
})();
