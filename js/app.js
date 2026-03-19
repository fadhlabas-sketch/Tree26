/**
 * app.js — نقطة الدخول
 */
const App = (() => {
  const KEY = 'shajarah_members_v2';

  function _save(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch(e){} }
  function _load()  { try { const d=localStorage.getItem(KEY); return d?JSON.parse(d):null; } catch(e){ return null; } }

  function _hideLoader() {
    const el = document.getElementById('loader');
    el.classList.add('out');
    setTimeout(() => el.remove(), 600);
  }

  async function _fetchAndRender(showLoader = true) {
    try {
      const members = await Sheets.getMembers();
      if (members.length) {
        _save(members);
        Tree.render(members);
        return true;
      }
    } catch(e) {
      console.warn('fetch error:', e.message);
    }
    return false;
  }

  async function load() {
    const cached = _load();

    if (cached && cached.length) {
      // عرض البيانات المحفوظة فوراً
      Tree.render(cached);
      _hideLoader();
      // تحديث في الخلفية
      _fetchAndRender(false).then(ok => { if(ok) UI.toast('🔄 تم تحديث البيانات'); });
    } else {
      // أول مرة — تحميل من الشبكة
      document.getElementById('loaderMsg').textContent = 'جاري التحميل من الشبكة…';
      const ok = await _fetchAndRender();
      if (!ok) {
        document.getElementById('loaderMsg').textContent = '⚠️ لا يوجد اتصال ولا بيانات محفوظة';
        setTimeout(_hideLoader, 2500);
      } else {
        _hideLoader();
      }
    }
  }

  async function reload() {
    const ok = await _fetchAndRender(false);
    if (!ok) UI.toast('⚠️ تعذّر التحديث');
  }

  function init() {
    UI.init();
    load();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
          .catch(e => console.warn('SW:', e));
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  return { reload };
})();s
