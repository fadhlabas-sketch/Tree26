/**
 * sheets.js
 * =========
 * All communication with Google Sheets via Apps Script.
 * Uses fetch() to call the deployed Web App endpoint.
 */

const Sheets = (() => {

  // ── Internal helper ──────────────────────────────────────────────────────
  async function _call(params) {
    const url = CONFIG.APPS_SCRIPT_URL;
    if (!url || url === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      throw new Error('Apps Script URL not configured. See js/config.js');
    }
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${url}?${qs}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Fetch all members from the 'members' sheet.
   * Returns an array of member objects.
   */
  async function getMembers() {
    const data = await _call({ action: 'getMembers' });
    return data.members || [];
  }

  /**
   * Submit a "add child" request to pending_requests sheet.
   */
  async function submitAddChild({ parentId, childName, birthDate, submittedBy }) {
    return _call({
      action: 'addPendingRequest',
      type: 'add_child',
      parentId,
      childName,
      birthDate: birthDate || '',
      submittedBy: submittedBy || 'anonymous',
    });
  }

  /**
   * Submit a "update details" request to pending_updates sheet.
   */
  async function submitUpdateDetails({ memberId, memberName, birthDate, phone, address, job, note, submittedBy }) {
    return _call({
      action: 'addPendingUpdate',
      memberId,
      memberName,
      birthDate:  birthDate || '',
      phone:      phone     || '',
      address:    address   || '',
      job:        job       || '',
      note:       note      || '',
      submittedBy: submittedBy || 'anonymous',
    });
  }

  /**
   * Get all pending add-child requests.
   */
  async function getPendingRequests() {
    const data = await _call({ action: 'getPendingRequests' });
    return data.requests || [];
  }

  /**
   * Get all pending update-details requests.
   */
  async function getPendingUpdates() {
    const data = await _call({ action: 'getPendingUpdates' });
    return data.updates || [];
  }

  /**
   * Approve an add-child request.
   * This creates a new member row and marks the request as approved.
   */
  async function approveAddChild(requestId) {
    return _call({ action: 'approveAddChild', requestId });
  }

  /**
   * Reject an add-child request.
   */
  async function rejectRequest(requestId, sheet) {
    return _call({ action: 'rejectRequest', requestId, sheet });
  }

  /**
   * Approve an update-details request.
   * This updates the member row and marks the request as approved.
   */
  async function approveUpdate(requestId) {
    return _call({ action: 'approveUpdate', requestId });
  }

  /**
   * Reject an update-details request.
   */
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
