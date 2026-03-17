/**
 * sheets.js
 * =========
 * كل التواصل مع Google Sheets عبر Apps Script
 */

const Sheets = (() => {

  async function _call(params) {
    const url = CONFIG.APPS_SCRIPT_URL;
    // فقط ارفض الـ placeholder الافتراضي
    if (!url || url === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      throw new Error('يجب تعيين APPS_SCRIPT_URL في config.js');
    }
    const qs  = new URLSearchParams(params).toString();
    const res = await fetch(`${url}?${qs}`, { redirect: 'follow' });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  }

  async function getMembers() {
    const data = await _call({ action: 'getMembers' });
    return data.members || [];
  }

  async function submitAddChild({ parentId, childName, birthDate, submittedBy }) {
    return _call({
      action: 'addPendingRequest',
      type: 'add_child',
      parentId,
      childName,
      birthDate:   birthDate   || '',
      submittedBy: submittedBy || 'anonymous',
    });
  }

  async function submitUpdateDetails({ memberId, memberName, birthDate, phone, address, job, note, submittedBy }) {
    return _call({
      action: 'addPendingUpdate',
      memberId,
      memberName,
      birthDate:   birthDate   || '',
      phone:       phone       || '',
      address:     address     || '',
      job:         job         || '',
      note:        note        || '',
      submittedBy: submittedBy || 'anonymous',
    });
  }

  async function getPendingRequests() {
    const data = await _call({ action: 'getPendingRequests' });
    return data.requests || [];
  }

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
