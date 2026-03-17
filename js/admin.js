/**
 * admin.js
 * ========
 * لوحة الإدارة: دخول، عرض الطلبات، قبول/رفض
 */

const Admin = (() => {

  let _authenticated = false;

  const getBackdrop    = () => document.getElementById('adminBackdrop');
  const getLoginDiv    = () => document.getElementById('adminLogin');
  const getContentDiv  = () => document.getElementById('adminContent');
  const getTabChildren = () => document.getElementById('adminTabChildren');
  const getTabUpdates  = () => document.getElementById('adminTabUpdates');

  // ── فتح/إغلاق اللوحة ─────────────────────────────────────────────────────
  function _open() {
    getBackdrop().classList.add('open');
    if (!_authenticated) {
      getLoginDiv().style.display   = '';
      getContentDiv().style.display = 'none';
    } else {
      _loadData();
    }
  }

  function _close() {
    getBackdrop().classList.remove('open');
  }

  // ── تسجيل الدخول ─────────────────────────────────────────────────────────
  function _login() {
    const pw = document.getElementById('adminPassword').value;
    if (pw === CONFIG.ADMIN_PASSWORD) {
      _authenticated = true;
      getLoginDiv().style.display   = 'none';
      getContentDiv().style.display = '';
      _loadData();
    } else {
      Interactions.showToast('❌ كلمة المرور غير صحيحة');
    }
  }

  // ── تحميل الطلبات ────────────────────────────────────────────────────────
  async function _loadData() {
    getTabChildren().innerHTML = '<p class="empty-state">جاري التحميل…</p>';
    getTabUpdates().innerHTML  = '<p class="empty-state">جاري التحميل…</p>';

    try {
      const [requests, updates] = await Promise.all([
        Sheets.getPendingRequests(),
        Sheets.getPendingUpdates(),
      ]);
      _renderChildRequests(requests.filter(r => r.status === 'pending'));
      _renderUpdateRequests(updates.filter(r => r.status === 'pending'));
    } catch (e) {
      getTabChildren().innerHTML = `<p class="empty-state">خطأ: ${e.message}</p>`;
      getTabUpdates().innerHTML  = `<p class="empty-state">خطأ: ${e.message}</p>`;
    }
  }

  // ── عرض طلبات إضافة الأبناء ──────────────────────────────────────────────
  function _renderChildRequests(requests) {
    if (requests.length === 0) {
      getTabChildren().innerHTML = '<p class="empty-state">لا توجد طلبات معلّقة لإضافة أبناء.</p>';
      return;
    }
    getTabChildren().innerHTML = requests.map(r => {
      const parent = Tree.getMember(r.parent_id);
      return `
        <div class="request-card" id="rc_${r.request_id}">
          <div class="request-card-title">إضافة: <strong>${r.child_name}</strong></div>
          <div class="request-meta">
            الأب/الأم: ${parent ? parent.name : r.parent_id}<br/>
            تاريخ الميلاد: ${r.birth_date || '—'}<br/>
            مقدّم الطلب: ${r.submitted_by || '—'}
          </div>
          <div class="request-actions">
            <button class="btn-approve" onclick="Admin.approveChild('${r.request_id}')">✓ موافقة</button>
            <button class="btn-reject"  onclick="Admin.rejectChild('${r.request_id}')">✕ رفض</button>
          </div>
        </div>`;
    }).join('');
  }

  // ── عرض طلبات تحديث البيانات ─────────────────────────────────────────────
  function _renderUpdateRequests(updates) {
    if (updates.length === 0) {
      getTabUpdates().innerHTML = '<p class="empty-state">لا توجد طلبات تحديث معلّقة.</p>';
      return;
    }
    getTabUpdates().innerHTML = updates.map(u => `
      <div class="request-card" id="ru_${u.request_id}">
        <div class="request-card-title">تحديث: <strong>${u.member_name}</strong></div>
        <div class="request-meta">
          ${u.birth_date ? `تاريخ الميلاد: ${u.birth_date}<br/>` : ''}
          ${u.phone      ? `الهاتف: ${u.phone}<br/>` : ''}
          ${u.address    ? `العنوان: ${u.address}<br/>` : ''}
          ${u.job        ? `المهنة: ${u.job}<br/>` : ''}
          ${u.note       ? `ملاحظة: ${u.note}<br/>` : ''}
          مقدّم الطلب: ${u.submitted_by || '—'}
        </div>
        <div class="request-actions">
          <button class="btn-approve" onclick="Admin.approveUpdate('${u.request_id}')">✓ موافقة</button>
          <button class="btn-reject"  onclick="Admin.rejectUpdate('${u.request_id}')">✕ رفض</button>
        </div>
      </div>`).join('');
  }

  // ── موافقة/رفض ───────────────────────────────────────────────────────────
  async function approveChild(requestId) {
    try {
      await Sheets.approveAddChild(requestId);
      document.getElementById(`rc_${requestId}`)?.remove();
      Interactions.showToast('✅ تمت إضافة الابن إلى الشجرة');
      App.reload();
    } catch (e) { Interactions.showToast('❌ ' + e.message); }
  }

  async function rejectChild(requestId) {
    try {
      await Sheets.rejectRequest(requestId, 'pending_requests');
      document.getElementById(`rc_${requestId}`)?.remove();
      Interactions.showToast('تم رفض الطلب');
    } catch (e) { Interactions.showToast('❌ ' + e.message); }
  }

  async function approveUpdate(requestId) {
    try {
      await Sheets.approveUpdate(requestId);
      document.getElementById(`ru_${requestId}`)?.remove();
      Interactions.showToast('✅ تم تحديث البيانات');
      App.reload();
    } catch (e) { Interactions.showToast('❌ ' + e.message); }
  }

  async function rejectUpdate(requestId) {
    try {
      await Sheets.rejectUpdate(requestId);
      document.getElementById(`ru_${requestId}`)?.remove();
      Interactions.showToast('تم رفض طلب التحديث');
    } catch (e) { Interactions.showToast('❌ ' + e.message); }
  }

  // ── تبديل التبويبات ───────────────────────────────────────────────────────
  function _initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        getTabChildren().style.display = tab === 'children' ? '' : 'none';
        getTabUpdates().style.display  = tab === 'updates'  ? '' : 'none';
      });
    });
  }

  function init() {
    document.getElementById('openAdmin').onclick     = _open;
    document.getElementById('closeAdmin').onclick    = _close;
    document.getElementById('adminLoginBtn').onclick = _login;

    document.getElementById('adminPassword').addEventListener('keydown', e => {
      if (e.key === 'Enter') _login();
    });

    getBackdrop().addEventListener('click', e => {
      if (e.target === getBackdrop()) _close();
    });

    _initTabs();
  }

  return { init, approveChild, rejectChild, approveUpdate, rejectUpdate };
})();
