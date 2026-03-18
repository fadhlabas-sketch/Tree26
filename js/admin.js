/**
 * admin.js
 * ========
 * - تسجيل الدخول كأدمن
 * - الأدمن يضيف أبناء ويعدّل البيانات مباشرة بدون موافقة
 * - الأدمن يرى الطلبات المعلّقة ويوافق أو يرفض
 */

const Admin = (() => {

  let _authenticated = false;
  const _processing  = new Set();

  const $ = id => document.getElementById(id);

  // ── هل المستخدم أدمن؟ (تستخدمها interactions.js) ────────────────────────
  function isAdmin() { return _authenticated; }

  // ── فتح / إغلاق ──────────────────────────────────────────────────────────
  function _open() {
    $('adminBackdrop').classList.add('open');
    if (!_authenticated) {
      $('adminLogin').style.display   = '';
      $('adminContent').style.display = 'none';
    } else {
      _loadData();
    }
  }

  function _close() {
    $('adminBackdrop').classList.remove('open');
  }

  // ── تسجيل الدخول ─────────────────────────────────────────────────────────
  function _login() {
    const pw = $('adminPassword').value;
    if (pw === CONFIG.ADMIN_PASSWORD) {
      _authenticated = true;
      $('adminLogin').style.display   = 'none';
      $('adminContent').style.display = '';
      _loadData();
      Interactions.showToast('✅ مرحباً بك يا مدير');
    } else {
      Interactions.showToast('❌ كلمة المرور غير صحيحة');
    }
  }

  // ── تحميل الطلبات المعلّقة ────────────────────────────────────────────────
  async function _loadData() {
    $('adminTabChildren').innerHTML = '<p class="empty-state">جاري التحميل…</p>';
    $('adminTabUpdates').innerHTML  = '<p class="empty-state">جاري التحميل…</p>';
    try {
      const [requests, updates] = await Promise.all([
        Sheets.getPendingRequests(),
        Sheets.getPendingUpdates(),
      ]);
      _renderChildRequests(requests.filter(r => r.status === 'pending'));
      _renderUpdateRequests(updates.filter(r => r.status === 'pending'));
    } catch (e) {
      $('adminTabChildren').innerHTML = `<p class="empty-state">خطأ: ${e.message}</p>`;
      $('adminTabUpdates').innerHTML  = `<p class="empty-state">خطأ: ${e.message}</p>`;
    }
  }

  // ── عرض طلبات إضافة الأبناء ──────────────────────────────────────────────
  function _renderChildRequests(requests) {
    if (requests.length === 0) {
      $('adminTabChildren').innerHTML = '<p class="empty-state">لا توجد طلبات معلّقة.</p>';
      return;
    }
    $('adminTabChildren').innerHTML = requests.map(r => {
      const parent = Tree.getMember(r.parent_id);
      return `
        <div class="request-card" id="rc_${r.request_id}">
          <div class="request-card-title">إضافة: <strong>${r.child_name}</strong></div>
          <div class="request-meta">
            الأب/الأم: ${parent ? parent.name : r.parent_id}<br/>
            سنة الميلاد: ${r.birth_date || '—'}<br/>
            مقدّم الطلب: ${r.submitted_by || '—'}
          </div>
          <div class="request-actions">
            <button class="btn-approve" onclick="Admin.approveChild('${r.request_id}')">✓ موافقة</button>
            <button class="btn-reject"  onclick="Admin.rejectChild('${r.request_id}')">✕ رفض</button>
          </div>
        </div>`;
    }).join('');
  }

  // ── عرض طلبات تعديل البيانات ─────────────────────────────────────────────
  function _renderUpdateRequests(updates) {
    if (updates.length === 0) {
      $('adminTabUpdates').innerHTML = '<p class="empty-state">لا توجد طلبات تعديل معلّقة.</p>';
      return;
    }
    $('adminTabUpdates').innerHTML = updates.map(u => `
      <div class="request-card" id="ru_${u.request_id}">
        <div class="request-card-title">تعديل: <strong>${u.member_name}</strong></div>
        <div class="request-meta">
          ${u.birth_date ? `سنة الميلاد: ${u.birth_date}<br/>` : ''}
          ${u.phone      ? `الهاتف: ${u.phone}<br/>`            : ''}
          ${u.address    ? `العنوان: ${u.address}<br/>`         : ''}
          ${u.job        ? `المهنة: ${u.job}<br/>`              : ''}
          ${u.note       ? `ملاحظة: ${u.note}<br/>`             : ''}
          مقدّم الطلب: ${u.submitted_by || '—'}
        </div>
        <div class="request-actions">
          <button class="btn-approve" onclick="Admin.approveUpdate('${u.request_id}')">✓ موافقة</button>
          <button class="btn-reject"  onclick="Admin.rejectUpdate('${u.request_id}')">✕ رفض</button>
        </div>
      </div>`).join('');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  إضافة ابن مباشرة (للأدمن بدون موافقة)
  // ══════════════════════════════════════════════════════════════════════════
  async function directAddChild(parentId, childName, birthYear) {
    return Sheets.directAddChild({ parentId, childName, birthYear });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  تعديل بيانات مباشرة (للأدمن بدون موافقة)
  // ══════════════════════════════════════════════════════════════════════════
  async function directUpdateMember(memberId, data) {
    return Sheets.directUpdateMember({ memberId, ...data });
  }

  // ── موافقة / رفض طلبات المستخدمين ────────────────────────────────────────
  async function approveChild(requestId) {
    if (_processing.has(requestId)) return;
    _processing.add(requestId);
    const card = $(`rc_${requestId}`);
    if (card) card.querySelectorAll('button').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
    try {
      await Sheets.approveAddChild(requestId);
      card?.remove();
      Interactions.showToast('✅ تمت إضافة الابن');
      App.reload();
    } catch (e) {
      Interactions.showToast('❌ ' + e.message);
      if (card) card.querySelectorAll('button').forEach(b => { b.disabled = false; b.style.opacity = ''; });
    } finally { _processing.delete(requestId); }
  }

  async function rejectChild(requestId) {
    if (_processing.has(requestId)) return;
    _processing.add(requestId);
    const card = $(`rc_${requestId}`);
    if (card) card.querySelectorAll('button').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
    try {
      await Sheets.rejectRequest(requestId, 'pending_requests');
      card?.remove();
      Interactions.showToast('تم رفض الطلب');
    } catch (e) {
      Interactions.showToast('❌ ' + e.message);
      if (card) card.querySelectorAll('button').forEach(b => { b.disabled = false; b.style.opacity = ''; });
    } finally { _processing.delete(requestId); }
  }

  async function approveUpdate(requestId) {
    if (_processing.has(requestId)) return;
    _processing.add(requestId);
    const card = $(`ru_${requestId}`);
    if (card) card.querySelectorAll('button').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
    try {
      await Sheets.approveUpdate(requestId);
      card?.remove();
      Interactions.showToast('✅ تم تحديث البيانات');
      App.reload();
    } catch (e) {
      Interactions.showToast('❌ ' + e.message);
      if (card) card.querySelectorAll('button').forEach(b => { b.disabled = false; b.style.opacity = ''; });
    } finally { _processing.delete(requestId); }
  }

  async function rejectUpdate(requestId) {
    if (_processing.has(requestId)) return;
    _processing.add(requestId);
    const card = $(`ru_${requestId}`);
    if (card) card.querySelectorAll('button').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
    try {
      await Sheets.rejectUpdate(requestId);
      card?.remove();
      Interactions.showToast('تم رفض الطلب');
    } catch (e) {
      Interactions.showToast('❌ ' + e.message);
      if (card) card.querySelectorAll('button').forEach(b => { b.disabled = false; b.style.opacity = ''; });
    } finally { _processing.delete(requestId); }
  }

  // ── تبديل التبويبات ───────────────────────────────────────────────────────
  function _initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        $('adminTabChildren').style.display = tab === 'children' ? '' : 'none';
        $('adminTabUpdates').style.display  = tab === 'updates'  ? '' : 'none';
      });
    });
  }

  function init() {
    $('openAdmin').onclick     = _open;
    $('closeAdmin').onclick    = _close;
    $('adminLoginBtn').onclick = _login;
    $('adminPassword').addEventListener('keydown', e => { if (e.key === 'Enter') _login(); });
    $('adminBackdrop').addEventListener('click', e => { if (e.target === $('adminBackdrop')) _close(); });
    _initTabs();
  }

  return { init, isAdmin, directAddChild, directUpdateMember, approveChild, rejectChild, approveUpdate, rejectUpdate };
})();
