/**
 * sheets.js
 * =========
 * التواصل مع Google Sheets عبر Apps Script
 */

const Sheets = (() => {

  // ── الاستدعاء الداخلي ────────────────────────────────────────────────────
  async function _call(params) {
    const url = CONFIG.APPS_SCRIPT_URL;

    // تحقق أن الرابط تم تعيينه
    if (!url || url === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      throw new Error('لم يتم تعيين رابط Apps Script في config.js');
    }

    const qs  = new URLSearchParams(params).toString();
    const res = await fetch(`${url}?${qs}`, { redirect: 'follow' });

    if (!res.ok) {
      throw new Error(`خطأ في الاتصال: ${res.status}`);
    }

    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  }

  // ── جلب كل الأعضاء ───────────────────────────────────────────────────────
  async function getMembers() {
    const data = await _call({ action: 'getMembers' });
    return data.members || [];
  }

  // ── إرسال طلب إضافة ابن ─────────────────────────────────────────────────
  async function submitAddChild({ parentId, childName, birthDate, submittedBy }) {
    return _call({
      action:      'addPendingRequest',
      type:        'add_child',
      parentId,
      childName,
      birthDate:   birthDate   || '',
      submittedBy: submittedBy || 'مجهول',
    });
  }

  // ── إرسال طلب تحديث البيانات ─────────────────────────────────────────────
  async function submitUpdateDetails({ memberId, memberName, birthDate, phone, address, job, note, submittedBy }) {
    return _call({
      action:      'addPendingUpdate',
      memberId,
      memberName,
      birthDate:   birthDate   || '',
      phone:       phone       || '',
      address:     address     || '',
      job:         job         || '',
      note:        note        || '',
      submittedBy: submittedBy || 'مجهول',
    });
  }

  // ── جلب طلبات الأبناء ────────────────────────────────────────────────────
  async function getPendingRequests() {
    const data = await _call({ action: 'getPendingRequests' });
    return data.requests || [];
  }

  // ── جلب طلبات التحديث ────────────────────────────────────────────────────
  async function getPendingUpdates() {
    const data = await _call({ action: 'getPendingUpdates' });
    return data.updates || [];
  }

  async function approveAddChild(requestId) {
    return _call({ action: 'approveAddChild', requestId });
  }

  async function rejectRequest(requestId, sheet) {
    return _call({ action: 'rejectRequest', requestId, sheet });
  }

  async function approveUpdate(requestId) {
    return _call({ action: 'approveUpdate', requestId });
  }

  async function rejectUpdate(requestId) {
    return _call({ action: 'rejectUpdate', requestId });
  }

  return {
    getMembers,
    submitAddChild,
    submitUpdateDetails,
    getPendingRequests,
    getPendingUpdates,
    approveAddChild,
    rejectRequest,
    approveUpdate,
    rejectUpdate,
  };
})();
