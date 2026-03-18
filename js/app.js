/**
 * app.js
 * ======
 * - عند أول فتح: تحميل البيانات وحفظها في localStorage
 * - عند فتح لاحق بدون إنترنت: تحميل من localStorage مباشرة
 * - عند وجود إنترنت: تحديث البيانات وتحديث localStorage
 * - شاشة تثبيت PWA إجبارية عند أول فتح
 */

const App = (() => {

  const STORAGE_KEY = 'shajarah_members';
  let _deferredInstallPrompt = null;  // حفظ حدث التثبيت

  // ════════════════════════════════════════════════════════
  //  تحميل الشجرة
  // ════════════════════════════════════════════════════════
  async function load() {
    const cached = _loadFromStorage();

    if (cached && cached.length > 0) {
      // عرض البيانات المحفوظة فوراً (لا انتظار)
      Tree.render(cached);
      Interactions.attachAll();
      _hideLoader();
      // ثم حاول التحديث من الشبكة في الخلفية
      _refreshInBackground();
    } else {
      // أول مرة — لا يوجد شيء محفوظ
      try {
        const members = await Sheets.getMembers();
        if (members.length > 0) {
          _saveToStorage(members);
          Tree.render(members);
          Interactions.attachAll();
          _hideLoader();
        } else {
          _hideLoader();
          Interactions.showToast('لا توجد بيانات في الشيت بعد', 4000);
        }
      } catch (e) {
        console.error('خطأ في التحميل:', e);
        _hideLoader();
        Interactions.showToast('⚠️ لا يوجد اتصال ولا بيانات محفوظة', 4000);
      }
    }
  }

  // تحديث في الخلفية عند وجود إنترنت
  async function _refreshInBackground() {
    try {
      const members = await Sheets.getMembers();
      if (members.length > 0) {
        _saveToStorage(members);
        Tree.render(members);
        Interactions.attachAll();
      }
    } catch (e) {
      // لا إنترنت — لا مشكلة، البيانات المحفوظة كافية
      console.log('تعذّر التحديث — العمل بالبيانات المحفوظة');
    }
  }

  // ── حفظ وتحميل من localStorage ──────────────────────────────────────────
  function _saveToStorage(members) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
    } catch (e) {
      console.warn('تعذّر الحفظ في localStorage:', e);
    }
  }

  function _loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  // ════════════════════════════════════════════════════════
  //  إعادة تحميل بعد موافقة المدير
  // ════════════════════════════════════════════════════════
  async function reload() {
    try {
      const members = await Sheets.getMembers();
      if (members.length > 0) {
        _saveToStorage(members);
        Tree.render(members);
        Interactions.attachAll();
      }
    } catch (e) {
      console.error('خطأ في إعادة التحميل:', e);
    }
  }

  // ════════════════════════════════════════════════════════
  //  شاشة تثبيت PWA — إجبارية عند أول فتح
  // ════════════════════════════════════════════════════════
  function _setupInstallScreen() {
    // هل سبق وتم التثبيت أو تم تخطّي الشاشة؟
    const alreadyShown = localStorage.getItem('install_screen_shown');
    if (alreadyShown) return;

    // أنشئ شاشة التثبيت
    const screen = document.createElement('div');
    screen.id = 'installScreen';
    screen.innerHTML = `
      <div class="install-box">
        <div class="install-icon">🌳</div>
        <h1 class="install-title">شجرة العائلة</h1>
        <p class="install-desc">
          ثبّت التطبيق على هاتفك للوصول السريع<br/>
          والعمل بدون إنترنت في أي وقت
        </p>
        <button class="install-btn" id="installBtn">
          📲 تثبيت التطبيق
        </button>
        <button class="install-skip" id="installSkip">
          متابعة بدون تثبيت ←
        </button>
        <p class="install-note" id="installNote"></p>
      </div>
    `;
    document.body.appendChild(screen);

    const installBtn = document.getElementById('installBtn');
    const skipBtn    = document.getElementById('installSkip');
    const note       = document.getElementById('installNote');

    // زر التثبيت
    installBtn.onclick = async () => {
      if (_deferredInstallPrompt) {
        // متصفح يدعم الـ install prompt (Chrome / Edge / Android)
        _deferredInstallPrompt.prompt();
        const { outcome } = await _deferredInstallPrompt.userChoice;
        _deferredInstallPrompt = null;
        if (outcome === 'accepted') {
          localStorage.setItem('install_screen_shown', '1');
          screen.remove();
        } else {
          note.textContent = 'يمكنك التثبيت لاحقاً من قائمة المتصفح';
        }
      } else {
        // iOS أو متصفح لا يدعم الـ prompt
        note.innerHTML = `
          <strong>لتثبيته على iPhone:</strong><br/>
          اضغط على زر المشاركة 
          <span style="font-size:1.1em">⬆️</span>
          ثم «إضافة إلى الشاشة الرئيسية»
        `;
      }
    };

    // زر التخطّي
    skipBtn.onclick = () => {
      localStorage.setItem('install_screen_shown', '1');
      screen.remove();
    };
  }

  // ════════════════════════════════════════════════════════
  //  إخفاء شاشة التحميل
  // ════════════════════════════════════════════════════════
  function _hideLoader() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    setTimeout(() => overlay.remove(), 600);
  }

  // ════════════════════════════════════════════════════════
  //  التشغيل الأوّلي
  // ════════════════════════════════════════════════════════
  function init() {
    Interactions.init();
    Search.init();
    Admin.init();
    Tree.initPanZoom();
    _setupInstallScreen();
    load();
  }

  // التقاط حدث تثبيت PWA قبل أن يعرضه المتصفح تلقائياً
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredInstallPrompt = e;
  });

  // تسجيل Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => console.log('Service Worker:', reg.scope))
        .catch(err => console.warn('Service Worker فشل:', err));
    });
  }

  return { init, reload };
})();

document.addEventListener('DOMContentLoaded', App.init);
