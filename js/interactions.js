/**
 * interactions.js
 * ===============
 * السلوك الجديد:
 *  - نقرة واحدة على أي اسم  →  تفتح قائمة بـ 4 خيارات:
 *      1. 👁 عرض التفاصيل
 *      2. 👶 إضافة ابن / ابنة
 *      3. ✏️ إضافة / تعديل البيانات
 *      4. 🔗 إظهار الأصل
 *  - لا يوجد ضغط مطوّل إطلاقاً
 */

const Interactions = (() => {

  let _currentNodeId = null;

  const $ = id => document.getElementById(id);

  // ════════════════════════════════════════════════════════
  //  إشعار منبثق
  // ════════════════════════════════════════════════════════
  function showToast(msg, duration = 3200) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
  }

  // ════════════════════════════════════════════════════════
  //  القائمة المنبثقة
  // ════════════════════════════════════════════════════════
  function _showMenu(nodeId, x, y) {
    _currentNodeId = nodeId;
    const menu = $('contextMenu');

    // حساب موقع القائمة بحيث لا تخرج عن الشاشة
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const mw  = 210;
    const mh  = 200; // تقريبي لـ 4 خيارات

    let left = x - mw / 2;
    let top  = y + 14;

    if (left < 8)        left = 8;
    if (left + mw > vw)  left = vw - mw - 8;
    if (top  + mh > vh)  top  = y - mh - 8;
    if (top  < 60)       top  = 60;

    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
    menu.classList.add('visible');
  }

  function _hideMenu() {
    $('contextMenu').classList.remove('visible');
    _currentNodeId = null;
  }

  // ════════════════════════════════════════════════════════
  //  لوحة التفاصيل الجانبية
  // ════════════════════════════════════════════════════════
  function _openDetails(memberId) {
    const m = Tree.getMember(memberId);
    if (!m) return;

    const fields = [
      { icon: '📅', label: 'سنة الميلاد', value: m.birth_date ? String(m.birth_date).replace(/-.*/, '') : '' },
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
      ${rows || '<p class="no-details">لا توجد تفاصيل مضافة بعد.<br/>اضغط على الاسم ثم اختر «إضافة / تعديل البيانات».</p>'}
    `;

    $('detailsPanel').classList.add('open');
    $('panelOverlay').classList.add('active');
  }

  function _closeDetails() {
    $('detailsPanel').classList.remove('open');
    $('panelOverlay').classList.remove('active');
  }

  // ════════════════════════════════════════════════════════
  //  نافذة النماذج
  // ════════════════════════════════════════════════════════
  function _openModal(html) {
    $('modalBody').innerHTML = html;
    $('modalBackdrop').classList.add('open');
  }

  function _closeModal() {
    $('modalBackdrop').classList.remove('open');
  }

  // ════════════════════════════════════════════════════════
  //  نموذج إضافة ابن
  // ════════════════════════════════════════════════════════
  function _showAddChildForm(parentId) {
    const parent   = Tree.getMember(parentId);
    const isAdmin  = Admin.isAdmin();
    const btnLabel = isAdmin ? '✅ إضافة مباشرة' : 'إرسال الطلب';
    const note     = isAdmin
      ? '<p class="admin-badge">🔑 وضع المدير — الإضافة فورية</p>'
      : '';

    _openModal(`
      <div class="modal-title">👶 إضافة ابن / ابنة</div>
      ${note}
      <p class="parent-info">إضافة إلى: <strong>${parent?.name || parentId}</strong></p>
      <div class="form-group">
        <label class="form-label">الاسم (مقطع واحد فقط) <span class="required-star">*</span></label>
        <input class="form-input" id="fc_name" type="text" placeholder="مثال: محمد" maxlength="30" />
        <small class="form-hint">أدخل الاسم الأول فقط بدون لقب</small>
      </div>
      <div class="form-group">
        <label class="form-label">سنة الميلاد</label>
        <input class="form-input" id="fc_birth" type="number" placeholder="مثال: 1990"
          min="1900" max="2025" style="width:140px" />
      </div>
      ${!isAdmin ? `<div class="form-group">
        <label class="form-label">اسمك (اختياري)</label>
        <input class="form-input" id="fc_by" type="text" placeholder="من قدّم هذا الطلب؟" />
      </div>` : ''}
      <button class="btn-primary" id="fc_submit">${btnLabel}</button>
      <p class="success-msg" id="fc_msg"></p>
    `);

    $('fc_submit').onclick = async () => {
      const name = $('fc_name').value.trim();
      if (!name) { showToast('⚠️ الاسم مطلوب'); return; }
      if (/\s/.test(name)) { showToast('⚠️ أدخل مقطعاً واحداً فقط — بدون مسافة'); return; }
      const btn = $('fc_submit');
      btn.textContent = 'جاري…';
      btn.disabled    = true;
      try {
        if (isAdmin) {
          // أدمن: إضافة مباشرة فورية
          await Admin.directAddChild(parentId, name, $('fc_birth').value);
          $('fc_msg').textContent = '✅ تمت الإضافة مباشرة!';
          btn.style.display = 'none';
          setTimeout(() => { _closeModal(); App.reload(); }, 900);
        } else {
          // مستخدم عادي: إرسال طلب
          await Sheets.submitAddChild({
            parentId,
            childName:   name,
            birthDate:   $('fc_birth').value,
            submittedBy: $('fc_by')?.value || '',
          });
          $('fc_msg').textContent = '✅ تم إرسال الطلب! سيظهر بعد موافقة المدير.';
          btn.style.display = 'none';
        }
      } catch (e) {
        showToast('❌ خطأ: ' + e.message);
        btn.textContent = btnLabel;
        btn.disabled    = false;
      }
    };
  }

  // ════════════════════════════════════════════════════════
  //  نموذج تعديل البيانات
  // ════════════════════════════════════════════════════════
  function _showAddDetailsForm(memberId) {
    const m       = Tree.getMember(memberId) || {};
    const isAdmin = Admin.isAdmin();
    const btnLabel = isAdmin ? '✅ حفظ مباشر' : 'إرسال التحديث';
    const note     = isAdmin
      ? '<p class="admin-badge">🔑 وضع المدير — الحفظ فوري</p>'
      : '';

    _openModal(`
      <div class="modal-title">✏️ إضافة / تعديل البيانات</div>
      ${note}
      <p class="parent-info">تعديل بيانات: <strong>${m.name || memberId}</strong></p>
      ${isAdmin ? `<div class="form-group">
        <label class="form-label">الاسم <span class="required-star">*</span></label>
        <input class="form-input" id="fd_name" type="text" value="${m.name || ''}" placeholder="اسم الشخص" />
      </div>` : ''}
      <div class="form-group">
        <label class="form-label">سنة الميلاد</label>
        <input class="form-input" id="fd_birth" type="number" placeholder="مثال: 1985"
          min="1900" max="2025" style="width:140px"
          value="${m.birth_date ? String(m.birth_date).replace(/-.*/, '') : ''}" />
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
      ${!isAdmin ? `<div class="form-group">
        <label class="form-label">اسمك (اختياري)</label>
        <input class="form-input" id="fd_by" type="text" placeholder="من قدّم هذا الطلب؟" />
      </div>` : ''}
      <button class="btn-primary" id="fd_submit">${btnLabel}</button>
      <p class="success-msg" id="fd_msg"></p>
    `);

    $('fd_submit').onclick = async () => {
      const btn = $('fd_submit');
      btn.textContent = 'جاري…';
      btn.disabled    = true;
      try {
        if (isAdmin) {
          // أدمن: حفظ مباشر فوري
          const newName = $('fd_name')?.value.trim();
          if (!newName) { showToast('⚠️ الاسم مطلوب'); btn.textContent = btnLabel; btn.disabled = false; return; }
          await Admin.directUpdateMember(memberId, {
            name:      newName,
            birthDate: $('fd_birth').value,
            phone:     $('fd_phone').value,
            address:   $('fd_address').value,
            job:       $('fd_job').value,
            note:      $('fd_note').value,
          });
          $('fd_msg').textContent = '✅ تم الحفظ مباشرة!';
          btn.style.display = 'none';
          setTimeout(() => { _closeModal(); App.reload(); }, 900);
        } else {
          // مستخدم عادي: إرسال طلب
          await Sheets.submitUpdateDetails({
            memberId,
            memberName:  m.name,
            birthDate:   $('fd_birth').value,
            phone:       $('fd_phone').value,
            address:     $('fd_address').value,
            job:         $('fd_job').value,
            note:        $('fd_note').value,
            submittedBy: $('fd_by')?.value || '',
          });
          $('fd_msg').textContent = '✅ تم إرسال التحديث! سيظهر بعد موافقة المدير.';
          btn.style.display = 'none';
        }
      } catch (e) {
        showToast('❌ خطأ: ' + e.message);
        btn.textContent = btnLabel;
        btn.disabled    = false;
      }
    };
  }

  // ════════════════════════════════════════════════════════
  //  إظهار سلسلة الأصل
  // ════════════════════════════════════════════════════════
  function _showLineage(memberId) {
    Tree.highlightLineage(memberId);

    // بناء سلسلة الأجداد من الأقدم للأحدث
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
          </div>
          ${i < chain.length - 1 ? '<div class="lineage-arrow">↓</div>' : ''}
        `).join('')}
      </div>
      <button class="btn-secondary" id="clearLineageBtn">✕ إخفاء التمييز</button>
    `);

    $('clearLineageBtn').onclick = () => {
      Tree.clearLineage();
      _closeModal();
    };
  }

  // ════════════════════════════════════════════════════════
  //  ربط الأحداث بكل عقدة — نقرة واحدة تفتح القائمة
  // ════════════════════════════════════════════════════════
  function _attachNodeEvents(el) {
    const id = el.dataset.id;

    // ── اللمس (موبايل) ──────────────────────────────────
    let touchMoved = false;
    let touchStartX = 0, touchStartY = 0;

    el.addEventListener('touchstart', e => {
      touchMoved  = false;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      const dx = Math.abs(e.touches[0].clientX - touchStartX);
      const dy = Math.abs(e.touches[0].clientY - touchStartY);
      if (dx > 6 || dy > 6) touchMoved = true;
    }, { passive: true });

    el.addEventListener('touchend', e => {
      if (touchMoved) return;          // كان سحباً وليس نقراً
      if ($('contextMenu').classList.contains('visible') &&
          _currentNodeId === id) {
        // نقر على نفس العقدة وهي مفتوحة → أغلق القائمة
        _hideMenu();
        return;
      }
      _hideMenu();
      // موقع النقرة من changedTouches
      const t = e.changedTouches[0];
      _showMenu(id, t.clientX, t.clientY);
    });

    // ── الماوس (سطح مكتب) ───────────────────────────────
    let mouseMoved = false;
    let mouseDownX = 0, mouseDownY = 0;

    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      mouseMoved  = false;
      mouseDownX  = e.clientX;
      mouseDownY  = e.clientY;
    });

    el.addEventListener('mousemove', e => {
      if (Math.abs(e.clientX - mouseDownX) > 4 ||
          Math.abs(e.clientY - mouseDownY) > 4) {
        mouseMoved = true;
      }
    });

    el.addEventListener('click', e => {
      if (mouseMoved) return;          // كان سحباً
      e.stopPropagation();
      if ($('contextMenu').classList.contains('visible') &&
          _currentNodeId === id) {
        _hideMenu();
        return;
      }
      _hideMenu();
      _showMenu(id, e.clientX, e.clientY);
    });
  }

  // ════════════════════════════════════════════════════════
  //  ربط كل العقد بعد الرسم
  // ════════════════════════════════════════════════════════
  function attachAll() {
    document.querySelectorAll('.tree-node').forEach(_attachNodeEvents);
  }

  // ════════════════════════════════════════════════════════
  //  التهيئة الأولى
  // ════════════════════════════════════════════════════════
  function init() {
    // إغلاق لوحة التفاصيل
    $('closeDetails').onclick = _closeDetails;
    $('panelOverlay').onclick = _closeDetails;

    // إغلاق النافذة
    $('closeModal').onclick = _closeModal;
    $('modalBackdrop').addEventListener('click', e => {
      if (e.target === $('modalBackdrop')) _closeModal();
    });

    // خيارات القائمة المنبثقة
    $('ctxViewDetails').onclick = () => {
      const id = _currentNodeId; _hideMenu();
      if (id) _openDetails(id);
    };
    $('ctxAddChild').onclick = () => {
      const id = _currentNodeId; _hideMenu();
      if (id) _showAddChildForm(id);
    };
    $('ctxAddDetails').onclick = () => {
      const id = _currentNodeId; _hideMenu();
      if (id) _showAddDetailsForm(id);
    };
    $('ctxShowLineage').onclick = () => {
      const id = _currentNodeId; _hideMenu();
      if (id) _showLineage(id);
    };

    // إغلاق القائمة عند النقر خارجها
    document.addEventListener('click', e => {
      if (!e.target.closest('#contextMenu') &&
          !e.target.closest('.tree-node')) {
        _hideMenu();
      }
    });
    document.addEventListener('touchstart', e => {
      if (!e.target.closest('#contextMenu') &&
          !e.target.closest('.tree-node')) {
        _hideMenu();
      }
    }, { passive: true });
  }

  return { init, attachAll, showToast };
})();
