/**
 * admin.js
 * ========
 * Admin panel: login, view pending requests, approve/reject.
 */

const Admin = (() => {

  let _authenticated = false;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const backdrop    = () => document.getElementById('adminBackdrop');
  const loginDiv    = () => document.getElementById('adminLogin');
  const contentDiv  = () => document.getElementById('adminContent');
  const tabChildren = () => document.getElementById('adminTabChildren');
  const tabUpdates  = () => document.getElementById('adminTabUpdates');

  // ── Open / Close ──────────────────────────────────────────────────────────
  function _open() {
    backdrop().classList.add('open');
    if (!_authenticated) {
      loginDiv().style.display = '';
      contentDiv().style.display = 'none';
    } else {
      _loadData();
    }
  }

  function _close() {
    backdrop().classList.remove('open');
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  function _login() {
    const pw = document.getElementById('adminPassword').value;
    if (pw === CONFIG.ADMIN_PASSWORD) {
      _authenticated = true;
      loginDiv().style.display = 'none';
      contentDiv().style.display = '';
      _loadData();
    } else {
      Interactions.showToast('❌ Incorrect password');
    }
  }

  // ── Load pending data ─────────────────────────────────────────────────────
  async function _loadData() {
    tabChildren().innerHTML = '<p class="empty-state">Loading…</p>';
    tabUpdates().innerHTML  = '<p class="empty-state">Loading…</p>';

    try {
      const [requests, updates] = await Promise.all([
        Sheets.getPendingRequests(),
        Sheets.getPendingUpdates(),
      ]);
      _renderChildRequests(requests.filter(r => r.status === 'pending'));
      _renderUpdateRequests(updates.filter(r => r.status === 'pending'));
    } catch (e) {
      tabChildren().innerHTML = `<p class="empty-state">Error: ${e.message}</p>`;
      tabUpdates().innerHTML  = `<p class="empty-state">Error: ${e.message}</p>`;
    }
  }

  // ── Render add-child requests ─────────────────────────────────────────────
  function _renderChildRequests(requests) {
    if (requests.length === 0) {
      tabChildren().innerHTML = '<p class="empty-state">No pending add-child requests.</p>';
      return;
    }
    tabChildren().innerHTML = requests.map(r => {
      const parent = Tree.getMember(r.parent_id);
      return `
        <div class="request-card" id="rc_${r.request_id}">
          <div class="request-card-title">Add Child: <strong>${r.child_name}</strong></div>
          <div class="request-meta">
            Parent: ${parent ? parent.name : r.parent_id}<br/>
            Birth Date: ${r.birth_date || '—'}<br/>
            Submitted by: ${r.submitted_by || '—'}
          </div>
          <div class="request-actions">
            <button class="btn-approve" onclick="Admin.approveChild('${r.request_id}')">✓ Approve</button>
            <button class="btn-reject"  onclick="Admin.rejectChild('${r.request_id}')">✕ Reject</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Render update-details requests ───────────────────────────────────────
  function _renderUpdateRequests(updates) {
    if (updates.length === 0) {
      tabUpdates().innerHTML = '<p class="empty-state">No pending update requests.</p>';
      return;
    }
    tabUpdates().innerHTML = updates.map(u => `
      <div class="request-card" id="ru_${u.request_id}">
        <div class="request-card-title">Update: <strong>${u.member_name}</strong></div>
        <div class="request-meta">
          ${u.birth_date ? `Birth Date: ${u.birth_date}<br/>` : ''}
          ${u.phone      ? `Phone: ${u.phone}<br/>` : ''}
          ${u.address    ? `Address: ${u.address}<br/>` : ''}
          ${u.job        ? `Job: ${u.job}<br/>` : ''}
          ${u.note       ? `Note: ${u.note}<br/>` : ''}
          Submitted by: ${u.submitted_by || '—'}
        </div>
        <div class="request-actions">
          <button class="btn-approve" onclick="Admin.approveUpdate('${u.request_id}')">✓ Approve</button>
          <button class="btn-reject"  onclick="Admin.rejectUpdate('${u.request_id}')">✕ Reject</button>
        </div>
      </div>
    `).join('');
  }

  // ── Approve / Reject handlers ─────────────────────────────────────────────
  async function approveChild(requestId) {
    try {
      await Sheets.approveAddChild(requestId);
      document.getElementById(`rc_${requestId}`)?.remove();
      Interactions.showToast('✅ Child added to tree');
      // Reload tree data
      App.reload();
    } catch (e) {
      Interactions.showToast('❌ ' + e.message);
    }
  }

  async function rejectChild(requestId) {
    try {
      await Sheets.rejectRequest(requestId, 'pending_requests');
      document.getElementById(`rc_${requestId}`)?.remove();
      Interactions.showToast('Request rejected');
    } catch (e) {
      Interactions.showToast('❌ ' + e.message);
    }
  }

  async function approveUpdate(requestId) {
    try {
      await Sheets.approveUpdate(requestId);
      document.getElementById(`ru_${requestId}`)?.remove();
      Interactions.showToast('✅ Details updated');
      App.reload();
    } catch (e) {
      Interactions.showToast('❌ ' + e.message);
    }
  }

  async function rejectUpdate(requestId) {
    try {
      await Sheets.rejectUpdate(requestId);
      document.getElementById(`ru_${requestId}`)?.remove();
      Interactions.showToast('Request rejected');
    } catch (e) {
      Interactions.showToast('❌ ' + e.message);
    }
  }

  // ── Tab switching ─────────────────────────────────────────────────────────
  function _initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('adminTabChildren').style.display = tab === 'children' ? '' : 'none';
        document.getElementById('adminTabUpdates').style.display  = tab === 'updates'  ? '' : 'none';
      });
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    document.getElementById('openAdmin').onclick  = _open;
    document.getElementById('closeAdmin').onclick = _close;
    document.getElementById('adminLoginBtn').onclick = _login;

    document.getElementById('adminPassword').addEventListener('keydown', e => {
      if (e.key === 'Enter') _login();
    });

    // Close on backdrop click
    backdrop().addEventListener('click', e => {
      if (e.target === backdrop()) _close();
    });

    _initTabs();
  }

  return { init, approveChild, rejectChild, approveUpdate, rejectUpdate };
})();
