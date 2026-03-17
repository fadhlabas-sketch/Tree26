/**
 * app.js
 * ======
 * نقطة الدخول الرئيسية للتطبيق
 */

const App = (() => {

  // ── تحميل البيانات وعرض الشجرة ────────────────────────────────────────────
  async function load() {
    try {
      const members = await Sheets.getMembers();

      if (members.length === 0) {
        _loadDemoData();
        return;
      }

      Tree.render(members);
      Interactions.attachAll();
      _hideLoader();

    } catch (e) {
      console.error('خطأ في التحميل:', e);
      // إظهار رسالة الخطأ ثم تحميل البيانات التجريبية
      _showError(e.message);
      setTimeout(() => {
        _loadDemoData();
        Interactions.showToast('⚠️ يعمل في الوضع التجريبي — تحقق من config.js', 5000);
      }, 2200);
    }
  }

  function _showError(msg) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.querySelector('.tree-loader').textContent = '⚠️';
      overlay.querySelector('p').textContent = 'خطأ: ' + msg;
    }
  }

  // ── إعادة تحميل الشجرة (بعد الموافقة على طلب) ────────────────────────────
  async function reload() {
    try {
      const members = await Sheets.getMembers();
      if (members.length > 0) {
        Tree.render(members);
        Interactions.attachAll();
      }
    } catch (e) {
      console.error('خطأ في إعادة التحميل:', e);
    }
  }

  // ── بيانات تجريبية للعرض ─────────────────────────────────────────────────
  function _loadDemoData() {
    const demo = [];

    // الجذر
    demo.push({
      id: '1', name: 'أحمد بن محمد', parent_id: '',
      birth_date: '1940-03-15', job: 'مزارع', address: 'بغداد، العراق', phone: '', note: ''
    });

    // الجيل الثاني
    [
      { id: '2', name: 'محمد أحمد',   parent_id: '1', job: 'مهندس' },
      { id: '3', name: 'فاطمة أحمد',  parent_id: '1', job: 'معلمة' },
      { id: '4', name: 'عمر أحمد',    parent_id: '1', job: 'طبيب'  },
      { id: '5', name: 'علي أحمد',    parent_id: '1', job: 'محامي' },
    ].forEach(m => demo.push({ birth_date:'', address:'', phone:'', note:'', ...m }));

    // الجيل الثالث
    [
      { id: '6',  name: 'سارة محمد',   parent_id: '2' },
      { id: '7',  name: 'خالد محمد',   parent_id: '2' },
      { id: '8',  name: 'ليلى محمد',   parent_id: '2' },
      { id: '9',  name: 'نور فاطمة',   parent_id: '3' },
      { id: '10', name: 'يوسف فاطمة',  parent_id: '3' },
      { id: '11', name: 'زينب عمر',    parent_id: '4' },
      { id: '12', name: 'حسن عمر',     parent_id: '4' },
      { id: '13', name: 'مريم علي',    parent_id: '5' },
      { id: '14', name: 'عبدالله علي', parent_id: '5' },
    ].forEach(m => demo.push({ birth_date:'', job:'', address:'', phone:'', note:'', ...m }));

    // الجيل الرابع
    let counter = 15;
    ['6','7','8','9','10','11','12','13','14'].forEach(pid => {
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const names = ['أحمد','محمد','علي','حسين','زينب','فاطمة','مريم','عمر'];
        demo.push({
          id: String(counter++),
          name: names[Math.floor(Math.random()*names.length)] + ' ' + (demo.find(m=>m.id===pid)?.name.split(' ')[0] || ''),
          parent_id: pid,
          birth_date:'', job:'', address:'', phone:'', note:''
        });
      }
    });

    Tree.render(demo);
    Interactions.attachAll();
    _hideLoader();
  }

  function _hideLoader() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    setTimeout(() => overlay.remove(), 600);
  }

  // ── التشغيل ───────────────────────────────────────────────────────────────
  function init() {
    Interactions.init();
    Search.init();
    Admin.init();
    Tree.initPanZoom();
    load();
  }

  // تسجيل الـ Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => console.log('Service Worker مسجّل:', reg.scope))
        .catch(err => console.warn('Service Worker فشل:', err));
    });
  }

  return { init, reload };
})();

// تشغيل التطبيق
document.addEventListener('DOMContentLoaded', App.init);
