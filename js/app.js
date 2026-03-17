/**
 * app.js
 * ======
 * Application entry point.
 * Orchestrates: data load → tree render → init interactions.
 */

const App = (() => {

  async function load() {
    try {
      const members = await Sheets.getMembers();

      if (members.length === 0) {
        // Sheet is configured but empty — show demo data
        _loadDemoData();
        return;
      }

      Tree.render(members);
      Interactions.attachAll();
      _hideLoader();
    } catch (e) {
      console.error('Error loading tree:', e);
      // Show the actual error so user knows what's wrong
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) {
        overlay.querySelector('p').textContent = '❌ ' + e.message;
        overlay.querySelector('.tree-loader').textContent = '⚠️';
      }
      // Still load demo after 2s so UI is browsable
      setTimeout(() => {
        _loadDemoData();
        Interactions.showToast('⚠️ خطأ في الاتصال — تم تحميل البيانات التجريبية', 5000);
      }, 2000);
    }
  }

  // ── Reload after admin approval ───────────────────────────────────────────
  async function reload() {
    try {
      const members = await Sheets.getMembers();
      Tree.render(members);
      Interactions.attachAll();
    } catch (e) {
      console.error('Reload error:', e);
    }
  }

  // ── Demo data (shown when Sheet is not configured yet) ────────────────────
  function _loadDemoData() {
    const demo = [];
    // Root
    demo.push({ id:'1', name:'Ahmad Al-Hassan', parent_id:'', birth_date:'1940-03-15', job:'Farmer', address:'Baghdad, Iraq' });
    // Gen 2
    const gen2 = [
      { id:'2', name:'Mohammed Hassan', parent_id:'1', birth_date:'1965-07-10', job:'Engineer' },
      { id:'3', name:'Fatima Hassan',   parent_id:'1', birth_date:'1967-02-20', job:'Teacher' },
      { id:'4', name:'Omar Hassan',     parent_id:'1', birth_date:'1970-11-05', job:'Doctor' },
    ];
    demo.push(...gen2);

    // Gen 3 under Mohammed
    [
      { id:'5',  name:'Sara Mohammed',  parent_id:'2' },
      { id:'6',  name:'Khalid Mohammed',parent_id:'2' },
      { id:'7',  name:'Layla Mohammed', parent_id:'2' },
    ].forEach(m => demo.push({ birth_date:'', job:'', address:'', phone:'', note:'', ...m }));

    // Gen 3 under Fatima
    [
      { id:'8',  name:'Nour Fatima',   parent_id:'3' },
      { id:'9',  name:'Yousef Fatima', parent_id:'3' },
    ].forEach(m => demo.push({ birth_date:'', job:'', address:'', phone:'', note:'', ...m }));

    // Gen 3 under Omar
    [
      { id:'10', name:'Zainab Omar',   parent_id:'4' },
      { id:'11', name:'Hassan Omar',   parent_id:'4' },
      { id:'12', name:'Mariam Omar',   parent_id:'4' },
    ].forEach(m => demo.push({ birth_date:'', job:'', address:'', phone:'', note:'', ...m }));

    // Gen 4
    const gen4Parents = ['5','6','7','8','9','10','11','12'];
    let idCounter = 13;
    gen4Parents.forEach(pid => {
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        demo.push({ id: String(idCounter++), name: `Member ${idCounter}`, parent_id: pid,
          birth_date:'', job:'', address:'', phone:'', note:'' });
      }
    });

    Tree.render(demo);
    Interactions.attachAll();
    _hideLoader();
    Interactions.showToast('📋 Demo mode — configure Google Sheets to load real data', 5000);
  }

  function _hideLoader() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
    setTimeout(() => overlay.remove(), 600);
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function init() {
    Interactions.init();
    Search.init();
    Admin.init();
    Tree.initPanZoom();
    load();
  }

  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(console.warn);
    });
  }

  return { init, reload };
})();

// Start the app
document.addEventListener('DOMContentLoaded', App.init);
