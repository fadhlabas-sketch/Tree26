/**
 * config.js — الإعدادات الرئيسية
 * ================================
 * ⚠️ عدّل هذه القيم قبل الرفع على GitHub
 */

const CONFIG = {

  // معرّف Google Sheet
  // تجده في رابط الشيت: https://docs.google.com/spreadsheets/d/ <<هنا>> /edit
  SHEET_ID: '1Tiwmo70s2mtXRykEKnqRv_bHTIpp-sTQ-KwtS2xghLM',

  // رابط Google Apps Script بعد النشر
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxUVFeCVlF9UO-NMWCsuzyrkkelMdCwVvFJWrQuAPI4dpCikibVlupfdxvMuYch_SM/exec',

  // كلمة مرور لوحة الإدارة
  ADMIN_PASSWORD: 'admin123',

  /**
   * ⚠️ مهم جداً للـ PWA على GitHub Pages
   * إذا كان اسم الـ repository مثلاً: family-tree
   * فاكتب: '/family-tree/'
   * إذا كان الموقع على domain خاص أو root، اكتب: '/'
   */
  BASE_URL: '/YOUR_REPO_NAME/',

  // أسماء أوراق الشيت (لا تغيّرها)
  SHEETS: {
    MEMBERS:          'members',
    PENDING_REQUESTS: 'pending_requests',
    PENDING_UPDATES:  'pending_updates',
  },

  // إعدادات مظهر الشجرة
  LAYOUT: {
    NODE_WIDTH:  140,
    NODE_HEIGHT: 52,
    H_SPACING:   60,
    V_SPACING:   110,
  },

  // مدة الضغط المطوّل (بالميلي ثانية)
  LONG_PRESS_DURATION: 700,
};
