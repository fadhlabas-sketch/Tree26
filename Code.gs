/**
 * Code.gs  —  Google Apps Script
 * ================================
 * Deploy this as a Web App:
 *   Extensions → Apps Script → Deploy → New Deployment
 *   Type: Web App | Execute as: Me | Who has access: Anyone
 *
 * Paste the Web App URL into js/config.js → APPS_SCRIPT_URL
 */

// ── Sheet helpers ─────────────────────────────────────────────────────────
function getSheet(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

// ⚠️ Replace with your actual Sheet ID
var SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';

// ── CORS headers ──────────────────────────────────────────────────────────
function _response(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Main router ───────────────────────────────────────────────────────────
function doGet(e) {
  try {
    var action = e.parameter.action;
    switch (action) {
      case 'getMembers':          return _getMembers();
      case 'addPendingRequest':   return _addPendingRequest(e.parameter);
      case 'addPendingUpdate':    return _addPendingUpdate(e.parameter);
      case 'getPendingRequests':  return _getPendingRequests();
      case 'getPendingUpdates':   return _getPendingUpdates();
      case 'approveAddChild':     return _approveAddChild(e.parameter.requestId);
      case 'rejectRequest':       return _rejectRequest(e.parameter.requestId, e.parameter.sheet);
      case 'approveUpdate':       return _approveUpdate(e.parameter.requestId);
      case 'rejectUpdate':        return _rejectUpdate(e.parameter.requestId);
      default:                    return _response({ error: 'Unknown action: ' + action });
    }
  } catch(err) {
    return _response({ error: err.message });
  }
}

// ── Get all members ───────────────────────────────────────────────────────
function _getMembers() {
  var sheet = getSheet('members');
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return _response({ members: [] });

  var headers = data[0];
  var members = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;   // skip empty rows
    var obj = {};
    headers.forEach(function(h, idx) { obj[h] = String(row[idx] || ''); });
    members.push(obj);
  }
  return _response({ members: members });
}

// ── Add pending add-child request ─────────────────────────────────────────
function _addPendingRequest(p) {
  var sheet = getSheet('pending_requests');
  var id    = 'REQ_' + Date.now();
  sheet.appendRow([
    id,           // request_id
    'add_child',  // type
    p.parentId,
    p.childName,
    p.birthDate,
    p.submittedBy,
    'pending',    // status
    new Date().toISOString(),
  ]);
  return _response({ success: true, requestId: id });
}

// ── Add pending update-details request ───────────────────────────────────
function _addPendingUpdate(p) {
  var sheet = getSheet('pending_updates');
  var id    = 'UPD_' + Date.now();
  sheet.appendRow([
    id,
    p.memberId,
    p.memberName,
    p.birthDate,
    p.phone,
    p.address,
    p.job,
    p.note,
    p.submittedBy,
    'pending',
    new Date().toISOString(),
  ]);
  return _response({ success: true, requestId: id });
}

// ── Get all pending add-child requests ───────────────────────────────────
function _getPendingRequests() {
  var sheet = getSheet('pending_requests');
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return _response({ requests: [] });

  var headers  = data[0];
  var requests = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    var obj = {};
    headers.forEach(function(h, idx) { obj[h] = String(row[idx] || ''); });
    requests.push(obj);
  }
  return _response({ requests: requests });
}

// ── Get all pending update requests ──────────────────────────────────────
function _getPendingUpdates() {
  var sheet = getSheet('pending_updates');
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return _response({ updates: [] });

  var headers = data[0];
  var updates = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    var obj = {};
    headers.forEach(function(h, idx) { obj[h] = String(row[idx] || ''); });
    updates.push(obj);
  }
  return _response({ updates: updates });
}

// ── Approve add-child: create member row, mark request approved ───────────
function _approveAddChild(requestId) {
  var reqSheet = getSheet('pending_requests');
  var reqData  = reqSheet.getDataRange().getValues();
  var headers  = reqData[0];
  var idIdx    = headers.indexOf('request_id');
  var statusIdx= headers.indexOf('status');

  var request  = null;
  var rowIndex = -1;
  for (var i = 1; i < reqData.length; i++) {
    if (String(reqData[i][idIdx]) === requestId) {
      request  = reqData[i];
      rowIndex = i + 1;  // 1-indexed for Sheets
      break;
    }
  }
  if (!request) return _response({ error: 'Request not found' });

  // Map columns
  var parentId  = String(request[headers.indexOf('parent_id')]);
  var childName = String(request[headers.indexOf('child_name')]);
  var birthDate = String(request[headers.indexOf('birth_date')]);

  // Create new member row
  var membersSheet = getSheet('members');
  var newId        = 'M_' + Date.now();
  membersSheet.appendRow([newId, childName, parentId, birthDate, '', '', '', '']);

  // Mark request as approved
  reqSheet.getRange(rowIndex, statusIdx + 1).setValue('approved');

  return _response({ success: true, newMemberId: newId });
}

// ── Reject a request ──────────────────────────────────────────────────────
function _rejectRequest(requestId, sheetName) {
  var sheet   = getSheet(sheetName);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idIdx   = headers.indexOf('request_id');
  var stIdx   = headers.indexOf('status');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === requestId) {
      sheet.getRange(i + 1, stIdx + 1).setValue('rejected');
      return _response({ success: true });
    }
  }
  return _response({ error: 'Not found' });
}

// ── Approve update-details ────────────────────────────────────────────────
function _approveUpdate(requestId) {
  var updSheet = getSheet('pending_updates');
  var updData  = updSheet.getDataRange().getValues();
  var uHeaders = updData[0];
  var idIdx    = uHeaders.indexOf('request_id');
  var statusIdx= uHeaders.indexOf('status');

  var update = null, updRowIdx = -1;
  for (var i = 1; i < updData.length; i++) {
    if (String(updData[i][idIdx]) === requestId) {
      update    = updData[i];
      updRowIdx = i + 1;
      break;
    }
  }
  if (!update) return _response({ error: 'Update request not found' });

  var memberId  = String(update[uHeaders.indexOf('member_id')]);
  var birthDate = String(update[uHeaders.indexOf('birth_date')]);
  var phone     = String(update[uHeaders.indexOf('phone')]);
  var address   = String(update[uHeaders.indexOf('address')]);
  var job       = String(update[uHeaders.indexOf('job')]);
  var note      = String(update[uHeaders.indexOf('note')]);

  // Find member and update
  var memSheet = getSheet('members');
  var memData  = memSheet.getDataRange().getValues();
  var mHeaders = memData[0];
  var mIdIdx   = mHeaders.indexOf('id');

  for (var j = 1; j < memData.length; j++) {
    if (String(memData[j][mIdIdx]) === memberId) {
      var row = j + 1;
      function setCol(colName, val) {
        var idx = mHeaders.indexOf(colName);
        if (idx >= 0 && val) memSheet.getRange(row, idx + 1).setValue(val);
      }
      setCol('birth_date', birthDate);
      setCol('phone',      phone);
      setCol('address',    address);
      setCol('job',        job);
      setCol('note',       note);
      break;
    }
  }

  // Mark update as approved
  updSheet.getRange(updRowIdx, statusIdx + 1).setValue('approved');
  return _response({ success: true });
}

// ── Reject update ─────────────────────────────────────────────────────────
function _rejectUpdate(requestId) {
  return _rejectRequest(requestId, 'pending_updates');
}
