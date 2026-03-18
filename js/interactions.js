/**
 * interactions.js
 * ===============
 * الإصلاحات:
 *  1. نقرة واحدة سريعة  → تفاصيل الشخص
 *  2. ضغط مطوّل         → قائمة (إضافة ابن / تعديل بيانات / إظهار الأصل)
 *  3. لا ارتباك بين النقر والضغط المطوّل
 */

const Interactions = (() => {

  let _currentNodeId  = null;
  let _longPressTimer = null;
  let _longPressFired = false;   // ← المفتاح: هل فعلاً حدث ضغط مطوّل؟

  const $ = id => document.getElementById(id);

  // ── إشعار منبثق ──────────────────────────────────────────────────────────
  function showToast(msg, duration = 3200) {
    const t = $('toast');
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

    $('detailsContent').innerHTML = `
      <div class="panel-avatar">👤</div>
      <div class="panel-name">${m.name}</div>
      ${rows || '<p class="no-details">لا توجد تفاصيل متاحة بعد.<br/>اضغط مطولاً على الاسم لإضافة بيانات.</p>'}
    `;
    $('detailsPanel').classList.add('open');
    $('panelOverlay').classList.add('active');
  }

  function _closeDetails() {
    $('detailsPanel').classList.remove('open');
    $('panelOverlay').classList.remove('active');
  }

  // ── القائمة المنبثقة ──────────────────────────────────────────────────────
  function _showContextMenu(nodeId, x, y) {
    _currentNodeId = nodeId;
    const menu = $('contextMenu');
    const vw   = window.innerWidth, vh = window.innerHeight;
    const mw   = 200, mh = 150;
    const left = Math.max(8, Math.min(x - mw / 2, vw - mw - 8));
    const top  = Math.min(y + 10, vh - mh - 8);
    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
    menu.classList.add('visible');
  }

  function _hideContextMenu() {
    $('contextMenu').classList.remove('visible');
    _currentNodeId = null;
  }

  // ── نافذة النماذج ────────────────────────────────────────────────────────
  function _openModal(html) {
    $('modalBody').innerHTML = html;
    $('modalBackdrop').classList.add('open');
  }

  function _closeModal() {
    $('modalBackdrop').classList.remove('open');
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

    $('fc_submit').onclick = async () => {
      const name = $('fc_name').value.trim();
      if (!name) { showToast('⚠️ الاسم الكامل مطلوب'); return; }
      const btn = $('fc_submit');
      btn.textContent = 'جاري الإرسال…';
      btn.disabled    = true;
      try {
        await Sheets.submitAddChild({
          parentId, childName: name,
          birthDate:   $('fc_birth').value,
          submittedBy: $('fc_by').value,
        });
        $('fc_msg').textContent  = '✅ تم إرسال الطلب! سيظهر بعد موافقة المدير.';
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

    $('fd_submit').onclick = async () => {
      const btn = $('fd_submit');
      btn.textContent = 'جاري الإرسال…';
      btn.disabled    = true;
      try {
        await Sheets.submitUpdateDetails({
          memberId, memberName: m.name,
          birthDate:   $('fd_birth').value,
          phone:       $('fd_phone').value,
          address:     $('fd_address').value,
          job:         $('fd_job').value,
          note:        $('fd_note').value,
          submittedBy: $('fd_by').value,
        });
        $('fd_msg').textContent  = '✅ تم إرسال التحديث! سيظهر بعد موافقة المدير.';
        btn.style.display = 'none';
      } catch (e) {
        showToast('❌ خطأ: ' + e.message);
        btn.textContent = 'إرسال التحديث';
        btn.disabled    = false;
      }
    };
  }

  // ── إظهار الأصل (سلسلة الأجداد) ─────────────────────────────────────────
  function _showLineage(memberId) {
    const ancestors = Tree.highlightLineage(memberId);

    // بناء نص الأجداد بالترتيب
    const chain = [];
    let current = memberId;
    while (current) {
      const m = Tree.getMember(current);
      if (!m) break;
      chain.unshift(m.name);
      current = m.parent_id && Tree.getMember(m.parent_id) ? m.parent_id : null;
    }

    const member = Tree.getMember(memberId);

    _openModal(`
      <div class="modal-title">🔗 سلسلة الأصل</div>
      <p class="parent-info">سلالة: <strong>${member?.name || memberId}</strong></p>
      <div class="lineage-chain">
        ${chain.map((name, i) => `
          <div class="lineage-step ${i === chain.length - 1 ? 'lineage-step-current' : ''}">
            <span class="lineage-index">${i + 1}</span>
            <span class="lineage-name">${name}</span>
            ${i < chain.length - 1 ? '<div class="lineage-arrow">↓</div>' : ''}
          </div>
        `).join('')}
      </div>
      <button class="btn-secondary" id="clearLineageBtn">✕ إخفاء التمييز</button>
    `);

    $('clearLineageBtn').onclick = () => {
      Tree.clearLineage();
      _closeModal();
    };
  }

  // ── كشف الضغط المطوّل ────────────────────────────────────────────────────
  function _startLongPress(nodeId, x, y) {
    _longPressFired = false;
    _longPressTimer = setTimeout(() => {
      _longPressFired = true;
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
    let touchMoved = false, touchX = 0, touchY = 0;

    // ── أحداث اللمس ──
    el.addEventListener('touchstart', e => {
      touchMoved      = false;
      _longPressFired = false;
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
      _startLongPress(id, touchX, touchY);
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      const dx = Math.abs(e.touches[0].clientX - touchX);
      const dy = Math.abs(e.touches[0].clientY - touchY);
      if (dx > 8 || dy > 8) {
        touchMoved = true;
        _cancelLongPress(id);
      }
    }, { passive: true });

    el.addEventListener('touchend', () => {
      _cancelLongPress(id);
      // فتح التفاصيل فقط إذا:
      // 1. لم تتحرك الأصابع
      // 2. لم يُفعَّل الضغط المطوّل
      // 3. القائمة مغلقة
      if (!touchMoved && !_longPressFired && !$('contextMenu').classList.contains('visible')) {
        _openDetails(id);
      }
    });

    // ── أحداث الماوس ──
    let mouseDownTime = 0, mouseMoved = false;

    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;   // الزر الأيسر فقط
      mouseDownTime   = Date.now();
      mouseMoved      = false;
      _longPressFired = false;
      _startLongPress(id, e.clientX, e.clientY);
    });

    el.addEventListener('mousemove', () => {
      if (Date.now() - mouseDownTime > 10) {
        mouseMoved = true;
        _cancelLongPress(id);
      }
    });

    el.addEventListener('mouseup', () => {
      _cancelLongPress(id);
      const elapsed = Date.now() - mouseDownTime;
      // فتح التفاصيل فقط عند نقر سريع وبدون تحرك وبدون ضغط مطوّل
      if (!mouseMoved && !_longPressFired && elapsed < 300 && !$('contextMenu').classList.contains('visible')) {
        _openDetails(id);
      }
    });

    el.addEventListener('mouseleave', () => _cancelLongPress(id));
  }

  function attachAll() {
    document.querySelectorAll('.tree-node').forEach(_attachNodeEvents);
  }

  // ── التهيئة ───────────────────────────────────────────────────────────────
  function init() {
    $('closeDetails').onclick = _closeDetails;
    $('panelOverlay').onclick = _closeDetails;
    $('closeModal').onclick   = _closeModal;

    $('ctxAddChild').onclick = () => {
      const id = _currentNodeId; _hideContextMenu();
      if (id) _showAddChildForm(id);
    };
    $('ctxAddDetails').onclick = () => {
      const id = _currentNodeId; _hideContextMenu();
      if (id) _showAddDetailsForm(id);
    };
    $('ctxShowLineage').onclick = () => {
      const id = _currentNodeId; _hideContextMenu();
      if (id) _showLineage(id);
    };

    $('modalBackdrop').addEventListener('click', e => {
      if (e.target === $('modalBackdrop')) _closeModal();
    });

    // إغلاق القائمة عند النقر خارجها
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('#contextMenu')) _hideContextMenu();
    });
    document.addEventListener('touchstart', e => {
      if (!e.target.closest('#contextMenu')) _hideContextMenu();
    }, { passive: true });
  }

  return { init, attachAll, showToast };
})();
