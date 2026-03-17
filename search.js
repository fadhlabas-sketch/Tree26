/**
 * search.js
 * =========
 * Supports 1-, 2-, and 3-part name searches.
 * Matches partial or full names, case-insensitive.
 * Focuses and highlights the matching node.
 */

const Search = (() => {

  const input   = () => document.getElementById('searchInput');
  const btn     = () => document.getElementById('searchBtn');
  const results = () => document.getElementById('searchResults');

  // ── Normalise a string for comparison ────────────────────────────────────
  function _norm(s) {
    return (s || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');  // strip diacritics
  }

  // ── Score a member against query parts ───────────────────────────────────
  // Returns a score >= 0; higher = better match.  0 = no match.
  function _score(member, parts) {
    const name = _norm(member.name);
    const words = name.split(/\s+/);

    let score = 0;
    parts.forEach(p => {
      if (name === p) score += 100;          // exact full name
      else if (name.startsWith(p)) score += 60;
      else if (name.includes(p)) score += 30;
      // also check individual words
      words.forEach(w => {
        if (w === p) score += 20;
        else if (w.startsWith(p)) score += 10;
      });
    });
    return score;
  }

  // ── Run search ────────────────────────────────────────────────────────────
  function _doSearch() {
    const raw   = input().value.trim();
    if (!raw) { _hideResults(); return; }

    const parts  = _norm(raw).split(/\s+/).filter(Boolean);
    const members = Tree.getMembers();

    const scored = members
      .map(m => ({ m, score: _score(m, parts) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);   // show max 20 results

    if (scored.length === 0) {
      _showResults([{ label: 'No results found', sub: '', id: null }]);
      return;
    }

    if (scored.length === 1) {
      // Single match: jump straight to it
      _selectMember(scored[0].m.id);
      _hideResults();
      return;
    }

    // Multiple matches: show list
    _showResults(scored.map(x => ({
      label: x.m.name,
      sub:   [x.m.birth_date, x.m.job].filter(Boolean).join(' · '),
      id:    x.m.id,
    })));
  }

  // ── Show/hide results dropdown ────────────────────────────────────────────
  function _showResults(items) {
    const el = results();
    el.innerHTML = items.map(item => `
      <div class="search-result-item" tabindex="0" data-id="${item.id || ''}">
        <div>${item.label}</div>
        ${item.sub ? `<div class="search-result-sub">${item.sub}</div>` : ''}
      </div>
    `).join('');

    el.querySelectorAll('.search-result-item[data-id]').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        if (id) _selectMember(id);
        _hideResults();
        input().value = row.querySelector('div').textContent;
      });
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter') row.click();
      });
    });

    el.classList.add('open');
  }

  function _hideResults() {
    results().classList.remove('open');
    results().innerHTML = '';
  }

  // ── Navigate to member ────────────────────────────────────────────────────
  function _selectMember(id) {
    Tree.centreOnNode(id);
    Tree.highlight(id);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    let debounceTimer;

    input().addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(_doSearch, 250);
    });

    input().addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(debounceTimer); _doSearch(); }
      if (e.key === 'Escape') _hideResults();
    });

    btn().addEventListener('click', _doSearch);

    // Close dropdown when clicking outside
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('.search-wrapper')) _hideResults();
    });
  }

  return { init };
})();
