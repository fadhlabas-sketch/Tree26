/**
 * sheets.js — التواصل مع Google Sheets
 */
const Sheets = (() => {

  async function _call(params) {
    const url = CONFIG.APPS_SCRIPT_URL;
    if (!url || url.includes('YOUR_APPS_SCRIPT')) {
      throw new Error('لم يتم تعيين رابط Apps Script في config.js');
    }
    let res;
    try {
      res = await fetch(`${url}?${new URLSearchParams(params)}`, { redirect: 'follow' });
    } catch (e) {
      throw new Error('تعذّر الاتصال — تحقق من الإنترنت');
    }
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  }

  const getMembers       = ()  => _call({ action: 'getMembers' }).then(d => d.members || []);
  const getPendingReqs   = ()  => _call({ action: 'getPendingRequests' }).then(d => d.requests || []);
  const getPendingUpds   = ()  => _call({ action: 'getPendingUpdates'  }).then(d => d.updates  || []);
  const approveChild     = id  => _call({ action: 'approveAddChild',    requestId: id });
  const approveUpdate    = id  => _call({ action: 'approveUpdate',      requestId: id });
  const rejectReq        = (id,sh) => _call({ action: 'rejectRequest',  requestId: id, sheet: sh });
  const rejectUpd        = id  => _call({ action: 'rejectUpdate',       requestId: id });
  const directAddChild   = p   => _call({ action: 'directAddChild',     ...p });
  const directUpdate     = p   => _call({ action: 'directUpdateMember', ...p });

  const submitAddChild = ({ parentId, childName, birthYear, submittedBy }) =>
    _call({ action: 'addPendingRequest', type: 'add_child', parentId, childName, birthDate: birthYear || '', submittedBy: submittedBy || 'مجهول' });

  const submitUpdateDetails = ({ memberId, memberName, birthDate, phone, address, job, note, submittedBy }) =>
    _call({ action: 'addPendingUpdate', memberId, memberName, birthDate: birthDate||'', phone: phone||'', address: address||'', job: job||'', note: note||'', submittedBy: submittedBy||'مجهول' });

  return { getMembers, getPendingReqs, getPendingUpds, approveChild, approveUpdate, rejectReq, rejectUpd, directAddChild, directUpdate, submitAddChild, submitUpdateDetails };
})();
