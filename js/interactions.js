/**
 * interactions.js
 * ===============
 * - نقر واحد → عرض التفاصيل
 * - ضغط مطوّل → قائمة إضافة ابن / تعديل بيانات
 */

const Interactions = (() => {

  let _currentNodeId  = null;
  let _longPressTimer = null;

  const getDetailsPanel   = () => document.getElementById('detailsPanel');
  const getDetailsContent = () => document.getElementById('detailsContent');
  const getPanelOverlay   = () => document.getElementById('panelOverlay');
  const getContextMenu    = () => document.getElementById('contextMenu');
  const getModalBackdrop  = () => document.getElementById('modalBackdrop');
  const getModalBody      = () => document.getElementById('modalBody');

  // ── إشعار منبثق ───────────────────────────────────────────────────────────
  function showToast(msg, duration = 3200) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
  }

  // ── لوحة التفاصيل ────────────────────────────────────────────────────────
  function _openDetails(memberId) {
    const m = Tree.getMember(memberId);
    if (!m) return;

    const fields = [
      { icon: '📅', label: 'تاريخ الميلاد', value: m.birth_date },
      { icon: '📞', label: 'رقم الهاتف',    value: m.phone      },
      { icon: '🏠', label: 'العنوان',        value: m.address    },
      { icon: '💼', label: 'المهنة',         value: m.job        },
      { icon: '📝', label: 'ملاحظة',         value: m.note       },
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

    getDetailsContent().innerHTML = `
      <div class="panel-avatar">👤</div>
      <div class="panel-name">${m.name}</div>
      ${rows || '<p style="color:var(--text-muted);text-align:center;font-size:.87rem;margin-top:8px">لا توجد تفاصيل متاحة بعد.</p>'}
    `;

    getDetailsPanel().classList.add('open');
    getPanelOverlay().classList.add('active');
  }

  function _closeDetails() {
    getDetailsPanel().classList.remove('open');
    getPanelOverlay().classList.remove('active');
  }

  // ── القائمة المنبثقة ──────────────────────────────────────────────────────
  function _showContextMenu(nodeId, x, y) {
    _currentNodeId = nodeId;
    const menu = getContextMenu();
    const vw = window.innerWidth, vh = window.innerHeight;
    const mw = 190, mh = 104;
    // في الواجهة العربية (RTL) نضع القائمة على اليمين
    const left = Math.max(8, Math.min(x - mw, vw - mw - 8));
    const top  = Math.min(y, vh - mh - 8);
    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
    menu.classList.add('visible');
  }

  function _hideContextMenu() {
    getContextMenu().classList.remove('visible');
    _currentNodeId = null;
  }

  // ── نافذة النماذج ────────────────────────────────────────────────────────
  function _openModal(html) {
    getModalBody().innerHTML = html;
    getModalBackdrop().classList.add('open');
  }

  function _closeModal() {
    getModalBackdrop().classList.remove('open');
  }

  // ── نموذج إضافة ابن ──────────────────────────────────────────────────────
  function _showAddChildForm(parentId) {
    const parent = Tree.getMember(parentId);
    _openModal(`
      <div class="modal-title">👶 إضافة ابن / ابنة</div>
      <p class="parent-info">إضافة إلى: <strong>${parent?.name || parentId}</strong></p>
      <div class="form-group">
        <label class="form-label">الاسم الكامل <span class="required-star">*</span></label>
        <input class="form-input" id="fc_name" type="text" placeholder="أدخل الاسم الكامل" />
      </div>
      <div class="form-group">
        <label class="form-label">تاريخ الميلاد</label>
        <input class="form-input" id="fc_birth" type="date" />
      </div>
      <div class="form-group">
        <label class="form-label">اسمك (اختياري)</label>
        <input class="form-input" id="fc_by" type="text" placeholder="من قدّم هذا الطلب؟" />
      </div>
      <button class="btn-primary" id="fc_submit">إرسال الطلب</button>
      <p class="success-msg" id="fc_msg"></p>
    `);

    document.getElementById('fc_submit').onclick = async () => {
      const name = document.getElementById('fc_name').value.trim();
      if (!name) { showToast('⚠️ الاسم الكامل مطلوب'); return; }

      const btn = document.getElementById('fc_submit');
      btn.textContent = 'جاري الإرسال…';
      btn.disabled    = true;

      try {
        await Sheets.submitAddChild({
          parentId,
          childName:   name,
          birthDate:   document.getElementById('fc_birth').value,
          submittedBy: document.getElementById('fc_by').value,
        });
        document.getElementById('fc_msg').textContent = '✅ تم إرسال الطلب! سيظهر بعد موافقة المدير.';
        btn.style.display = 'none';
      } catch (e) {
        showToast('❌ خطأ: ' + e.message);
        btn.textContent = 'إرسال الطلب';
        btn.disabled    = false;
      }
    };
  }

  // ── نموذج تعديل البيانات ─────────────────────────────────────────────────
  function _showAddDetailsForm(memberId) {
    const m = Tree.getMember(memberId) || {};
    _openModal(`
      <div class="modal-title">✏️ إضافة / تعديل البيانات</div>
      <p class="parent-info">تعديل بيانات: <strong>${m.name || memberId}</strong></p>
      <div class="form-group">
        <label class="form-label">تاريخ الميلاد</label>
        <input class="form-input" id="fd_birth" type="date" value="${m.birth_date || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">رقم الهاتف</label>
        <input class="form-input" id="fd_phone" type="tel" placeholder="07XX XXX XXXX" value="${m.phone || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">العنوان</label>
        <input class="form-input" id="fd_address" type="text" placeholder="المدينة، المحافظة" value="${m.address || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">المهنة</label>
        <input class="form-input" id="fd_job" type="text" placeholder="مهندس، معلم، طبيب…" value="${m.job || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">ملاحظة</label>
        <textarea class="form-textarea" id="fd_note" placeholder="أي ملاحظة…">${m.note || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">اسمك (اختياري)</label>
        <input class="form-input" id="fd_by" type="text" placeholder="من قدّم هذا الطلب؟" />
      </div>
      <button class="btn-primary" id="fd_submit">إرسال التحديث</button>
      <p class="success-msg" id="fd_msg"></p>
    `);

    document.getElementById('fd_submit').onclick = async () => {
      const btn = document.getElementById('fd_submit');
      btn.textContent = 'جاري الإرسال…';
      btn.disabled    = true;
      try {
        await Sheets.submitUpdateDetails({
          memberId,
          memberName:  m.name,
          birthDate:   document.getElementById('fd_birth').value,
          phone:       document.getElementById('fd_phone').value,
          address:     document.getElementById('fd_address').value,
          job:         document.getElementById('fd_job').value,
          note:        document.getElementById('fd_note').value,
          submittedBy: document.getElementById('fd_by').value,
        });
        document.getElementById('fd_msg').textContent = '✅ تم إرسال التحديث! سيظهر بعد موافقة المدير.';
        btn.style.display = 'none';
      } catch (e) {
        showToast('❌ خطأ: ' + e.message);
        btn.textContent = 'إرسال التحديث';
        btn.disabled    = false;
      }
    };
  }

  // ── كشف الضغط المطوّل ────────────────────────────────────────────────────
  function _startLongPress(nodeId, x, y) {
    _longPressTimer = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
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

  // ── ربط الأحداث بكل عقدة ─────────────────────────────────────────────────
  function _attachNodeEvents(el) {
    const id = el.dataset.id;
    let touchMoved = false, touchX, touchY;

    // أحداث اللمس
    el.addEventListener('touchstart', e => {
      touchMoved = false;
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
      _startLongPress(id, touchX, touchY);
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      const dx = Math.abs(e.touches[0].clientX - touchX);
      const dy = Math.abs(e.touches[0].clientY - touchY);
      if (dx > 8 || dy > 8) { touchMoved = true; _cancelLongPress(id); }
    }, { passive: true });

    el.addEventListener('touchend', () => {
      _cancelLongPress(id);
      if (!touchMoved && !getContextMenu().classList.contains('visible')) {
        _openDetails(id);
      }
    });

    // أحداث الماوس
    let mouseDownTime = 0, mouseMoved = false;

    el.addEventListener('mousedown', e => {
      mouseDownTime = Date.now();
      mouseMoved    = false;
      _startLongPress(id, e.clientX, e.clientY);
    });
    el.addEventListener('mousemove', () => { mouseMoved = true; _cancelLongPress(id); });
    el.addEventListener('mouseup', () => {
      _cancelLongPress(id);
      const elapsed = Date.now() - mouseDownTime;
      if (!mouseMoved && elapsed < CONFIG.LONG_PRESS_DURATION && !getContextMenu().classList.contains('visible')) {
        _openDetails(id);
      }
    });
    el.addEventListener('mouseleave', () => _cancelLongPress(id));
  }

  // ── ربط كل العقد بعد الرسم ───────────────────────────────────────────────
  function attachAll() {
    document.querySelectorAll('.tree-node').forEach(_attachNodeEvents);
  }

  // ── التهيئة ───────────────────────────────────────────────────────────────
  function init() {
    document.getElementById('closeDetails').onclick   = _closeDetails;
    document.getElementById('panelOverlay').onclick   = _closeDetails;
    document.getElementById('closeModal').onclick     = _closeModal;

    document.getElementById('ctxAddChild').onclick = () => {
      const id = _currentNodeId; _hideContextMenu();
      if (id) _showAddChildForm(id);
    };
    document.getElementById('ctxAddDetails').onclick = () => {
      const id = _currentNodeId; _hideContextMenu();
      if (id) _showAddDetailsForm(id);
    };

    document.getElementById('modalBackdrop').addEventListener('click', e => {
      if (e.target === document.getElementById('modalBackdrop')) _closeModal();
    });

    document.addEventListener('mousedown', e => {
      if (!e.target.closest('#contextMenu')) _hideContextMenu();
    });
    document.addEventListener('touchstart', e => {
      if (!e.target.closest('#contextMenu')) _hideContextMenu();
    }, { passive: true });
  }

  return { init, attachAll, showToast };
})();
