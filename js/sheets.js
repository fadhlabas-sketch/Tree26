/**
 * sheets.js — التواصل مع Google Sheets
 */

const Sheets = (() => {

  async function _call(params) {
    const url = CONFIG.APPS_SCRIPT_URL;

    // تحقق من الـ URL
    if (!url || url.includes('YOUR_APPS_SCRIPT')) {
      throw new Error('لم يتم تعيين رابط Apps Script في config.js');
    }

    const qs = new URLSearchParams(params).toString();

    let res;
    try {
      res = await fetch(`${url}?${qs}`, {
        method:   'GET',
        redirect: 'follow',
        mode:     'cors',
      });
    } catch (networkErr) {
      // خطأ شبكة — إما لا إنترنت أو CORS
      throw new Error('تعذّر الاتصال بالخادم — تحقق من الإنترنت أو إعادة نشر Apps Script');
    }

    if (!res.ok) {
      throw new Error(`خطأ HTTP: ${res.status}`);
    }

    let json;
    try {
      json = await res.json();
    } catch (parseErr) {
      throw new Error('استجابة غير صالحة من الخادم');
    }

    if (json.error) throw new Error(json.error);
    return json;
  }

  // ── جلب الأعضاء ──────────────────────────────────────────────────────────
  async function getMembers() {
    const data = await _call({ action: 'getMembers' });
    return data.members || [];
  }

  // ── إرسال طلب إضافة ابن (مستخدم عادي) ───────────────────────────────────
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

  // ── إرسال طلب تحديث (مستخدم عادي) ───────────────────────────────────────
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

  // ── إضافة ابن مباشرة (أدمن) ──────────────────────────────────────────────
  async function directAddChild({ parentId, childName, birthYear }) {
    return _call({
      action:    'directAddChild',
      parentId,
      childName,
      birthYear: birthYear || '',
    });
  }

  // ── تعديل عضو مباشرة (أدمن) ──────────────────────────────────────────────
  async function directUpdateMember({ memberId, name, birthDate, phone, address, job, note }) {
    return _call({
      action:    'directUpdateMember',
      memberId,
      name:      name      || '',
      birthDate: birthDate || '',
      phone:     phone     || '',
      address:   address   || '',
      job:       job       || '',
      note:      note      || '',
    });
  }

  // ── جلب الطلبات المعلّقة ──────────────────────────────────────────────────
  async function getPendingRequests() {
    const data = await _call({ action: 'getPendingRequests' });
    return data.requests || [];
  }

  async function getPendingUpdates() {
    const data = await _call({ action: 'getPendingUpdates' });
    return data.updates || [];
  }

  // ── موافقة / رفض ─────────────────────────────────────────────────────────
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
    directAddChild,
    directUpdateMember,
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
