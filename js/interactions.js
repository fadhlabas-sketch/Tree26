/**
 * interactions.js
 * ===============
 * Handles:
 *   - Single click → show details panel
 *   - Long press (mouse & touch) → show context menu
 *   - Context menu: Add Child / Add Details forms
 */

const Interactions = (() => {

  let _currentNodeId = null;    // node receiving the long press
  let _longPressTimer = null;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const detailsPanel  = () => document.getElementById('detailsPanel');
  const detailsContent= () => document.getElementById('detailsContent');
  const panelOverlay  = () => document.getElementById('panelOverlay');
  const contextMenu   = () => document.getElementById('contextMenu');
  const modalBackdrop = () => document.getElementById('modalBackdrop');
  const modalBody     = () => document.getElementById('modalBody');

  // ── Utility ───────────────────────────────────────────────────────────────
  function showToast(msg, duration = 3000) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
  }

  // ── Details panel ─────────────────────────────────────────────────────────
  function _openDetails(memberId) {
    const m = Tree.getMember(memberId);
    if (!m) return;

    const fields = [
      { icon: '📅', label: 'Birth Date',   value: m.birth_date },
      { icon: '📞', label: 'Phone',         value: m.phone      },
      { icon: '🏠', label: 'Address',       value: m.address    },
      { icon: '💼', label: 'Job',           value: m.job        },
      { icon: '📝', label: 'Note',          value: m.note       },
    ];

    const rows = fields
      .filter(f => f.value)
      .map(f => `
        <div class="detail-row">
          <span class="detail-icon">${f.icon}</span>
          <div>
            <div class="detail-label">${f.label}</div>
            <div class="detail-value">${f.value}</div>
          </div>
        </div>`)
      .join('');

    detailsContent().innerHTML = `
      <div class="panel-avatar">👤</div>
      <div class="panel-name">${m.name}</div>
      ${rows || '<p style="color:var(--text-muted);text-align:center;font-size:.85rem">No details available yet.</p>'}
    `;

    detailsPanel().classList.add('open');
    panelOverlay().classList.add('active');
  }

  function _closeDetails() {
    detailsPanel().classList.remove('open');
    panelOverlay().classList.remove('active');
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  function _showContextMenu(nodeId, x, y) {
    _currentNodeId = nodeId;
    const menu = contextMenu();

    // Position near the tap, keeping inside viewport
    const vw = window.innerWidth, vh = window.innerHeight;
    const mw = 180, mh = 96;
    const left = Math.min(x, vw - mw - 8);
    const top  = Math.min(y, vh - mh - 8);

    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
    menu.classList.add('visible');
  }

  function _hideContextMenu() {
    contextMenu().classList.remove('visible');
    _currentNodeId = null;
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function _openModal(html) {
    modalBody().innerHTML = html;
    modalBackdrop().classList.add('open');
  }

  function _closeModal() {
    modalBackdrop().classList.remove('open');
  }

  // ── Add Child form ────────────────────────────────────────────────────────
  function _showAddChildForm(parentId) {
    const parent = Tree.getMember(parentId);
    _openModal(`
      <div class="modal-title">👶 Add Child</div>
      <p style="color:var(--text-muted);font-size:.82rem;margin-bottom:16px">
        Adding a child to: <strong style="color:var(--accent)">${parent?.name || parentId}</strong>
      </p>
      <div class="form-group">
        <label class="form-label">Child Name <span class="required-star">*</span></label>
        <input class="form-input" id="fc_name" type="text" placeholder="Full name" />
      </div>
      <div class="form-group">
        <label class="form-label">Birth Date</label>
        <input class="form-input" id="fc_birth" type="date" />
      </div>
      <div class="form-group">
        <label class="form-label">Your Name (optional)</label>
        <input class="form-input" id="fc_by" type="text" placeholder="Who is submitting this?" />
      </div>
      <button class="btn-primary" id="fc_submit">Submit Request</button>
      <p id="fc_msg" style="margin-top:10px;font-size:.8rem;color:var(--success)"></p>
    `);

    document.getElementById('fc_submit').onclick = async () => {
      const name = document.getElementById('fc_name').value.trim();
      if (!name) { showToast('⚠️ Child name is required'); return; }

      document.getElementById('fc_submit').textContent = 'Submitting…';
      document.getElementById('fc_submit').disabled = true;

      try {
        await Sheets.submitAddChild({
          parentId,
          childName: name,
          birthDate: document.getElementById('fc_birth').value,
          submittedBy: document.getElementById('fc_by').value,
        });
        document.getElementById('fc_msg').textContent = '✅ Request submitted! It will appear after admin approval.';
        document.getElementById('fc_submit').style.display = 'none';
      } catch (e) {
        showToast('❌ Error: ' + e.message);
        document.getElementById('fc_submit').textContent = 'Submit Request';
        document.getElementById('fc_submit').disabled = false;
      }
    };
  }

  // ── Add / Update Details form ─────────────────────────────────────────────
  function _showAddDetailsForm(memberId) {
    const m = Tree.getMember(memberId) || {};
    _openModal(`
      <div class="modal-title">✏️ Add / Update Details</div>
      <p style="color:var(--text-muted);font-size:.82rem;margin-bottom:16px">
        Updating: <strong style="color:var(--accent)">${m.name || memberId}</strong>
      </p>
      <div class="form-group">
        <label class="form-label">Birth Date</label>
        <input class="form-input" id="fd_birth" type="date" value="${m.birth_date || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Phone Number</label>
        <input class="form-input" id="fd_phone" type="tel" placeholder="+1 555 000 0000" value="${m.phone || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <input class="form-input" id="fd_address" type="text" placeholder="City, Country" value="${m.address || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Job / Occupation</label>
        <input class="form-input" id="fd_job" type="text" placeholder="Engineer, Teacher…" value="${m.job || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Note</label>
        <textarea class="form-textarea" id="fd_note" placeholder="Any note…">${m.note || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Your Name (optional)</label>
        <input class="form-input" id="fd_by" type="text" placeholder="Who is submitting?" />
      </div>
      <button class="btn-primary" id="fd_submit">Submit Update</button>
      <p id="fd_msg" style="margin-top:10px;font-size:.8rem;color:var(--success)"></p>
    `);

    document.getElementById('fd_submit').onclick = async () => {
      document.getElementById('fd_submit').textContent = 'Submitting…';
      document.getElementById('fd_submit').disabled = true;
      try {
        await Sheets.submitUpdateDetails({
          memberId,
          memberName: m.name,
          birthDate: document.getElementById('fd_birth').value,
          phone:     document.getElementById('fd_phone').value,
          address:   document.getElementById('fd_address').value,
          job:       document.getElementById('fd_job').value,
          note:      document.getElementById('fd_note').value,
          submittedBy: document.getElementById('fd_by').value,
        });
        document.getElementById('fd_msg').textContent = '✅ Update submitted! It will appear after admin approval.';
        document.getElementById('fd_submit').style.display = 'none';
      } catch (e) {
        showToast('❌ Error: ' + e.message);
        document.getElementById('fd_submit').textContent = 'Submit Update';
        document.getElementById('fd_submit').disabled = false;
      }
    };
  }

  // ── Long press detection ──────────────────────────────────────────────────
  function _startLongPress(nodeId, x, y) {
    _longPressTimer = setTimeout(() => {
      // Vibrate on mobile if available
      if (navigator.vibrate) navigator.vibrate(40);
      const el = document.querySelector(`.tree-node[data-id="${nodeId}"]`);
      if (el) el.classList.add('long-pressed');
      _showContextMenu(nodeId, x, y);
    }, CONFIG.LONG_PRESS_DURATION);
  }

  function _cancelLongPress(nodeId) {
    clearTimeout(_longPressTimer);
    const el = document.querySelector(`.tree-node[data-id="${nodeId}"]`);
    if (el) el.classList.remove('long-pressed');
  }

  // ── Attach events to a newly rendered node element ────────────────────────
  function _attachNodeEvents(el) {
    const id = el.dataset.id;

    // ── Touch ──
    let touchMoved = false;
    let touchStartX, touchStartY;

    el.addEventListener('touchstart', e => {
      touchMoved = false;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      _startLongPress(id, touchStartX + 10, touchStartY + 10);
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      const dx = Math.abs(e.touches[0].clientX - touchStartX);
      const dy = Math.abs(e.touches[0].clientY - touchStartY);
      if (dx > 8 || dy > 8) {
        touchMoved = true;
        _cancelLongPress(id);
      }
    }, { passive: true });

    el.addEventListener('touchend', e => {
      _cancelLongPress(id);
      if (!touchMoved && !contextMenu().classList.contains('visible')) {
        _openDetails(id);
      }
    });

    // ── Mouse ──
    let mouseDownTime = 0;
    let mouseMoved = false;

    el.addEventListener('mousedown', e => {
      mouseDownTime = Date.now();
      mouseMoved = false;
      _startLongPress(id, e.clientX + 10, e.clientY + 10);
    });

    el.addEventListener('mousemove', () => {
      mouseMoved = true;
      _cancelLongPress(id);
    });

    el.addEventListener('mouseup', e => {
      _cancelLongPress(id);
      const elapsed = Date.now() - mouseDownTime;
      if (!mouseMoved && elapsed < CONFIG.LONG_PRESS_DURATION && !contextMenu().classList.contains('visible')) {
        _openDetails(id);
      }
    });

    el.addEventListener('mouseleave', () => _cancelLongPress(id));
  }

  // ── Observe new nodes (called after render) ───────────────────────────────
  function attachAll() {
    document.querySelectorAll('.tree-node').forEach(_attachNodeEvents);
  }

  // ── Wire up static buttons ────────────────────────────────────────────────
  function init() {
    // Close details panel
    document.getElementById('closeDetails').onclick = _closeDetails;
    document.getElementById('panelOverlay').onclick = _closeDetails;

    // Context menu items
    document.getElementById('ctxAddChild').onclick = () => {
      const id = _currentNodeId;
      _hideContextMenu();
      if (id) _showAddChildForm(id);
    };
    document.getElementById('ctxAddDetails').onclick = () => {
      const id = _currentNodeId;
      _hideContextMenu();
      if (id) _showAddDetailsForm(id);
    };

    // Dismiss context menu on outside click/touch
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('#contextMenu')) _hideContextMenu();
    });
    document.addEventListener('touchstart', e => {
      if (!e.target.closest('#contextMenu')) _hideContextMenu();
    }, { passive: true });

    // Close modal
    document.getElementById('closeModal').onclick = _closeModal;
    document.getElementById('modalBackdrop').addEventListener('click', e => {
      if (e.target === document.getElementById('modalBackdrop')) _closeModal();
    });
  }

  return { init, attachAll, showToast };
})();
