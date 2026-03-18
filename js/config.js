/**
 * config.js — الإعدادات الرئيسية
 * ⚠️ عدّل هذه القيم فقط
 */

const CONFIG = {

  // معرّف Google Sheet
  SHEET_ID: '1Tiwmo70s2mtXRykEKnqRv_bHTIpp-sTQ-KwtS2xghLM',

  // رابط Apps Script (بعد النشر)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxp-7hFPqIib6gUmbQIsC0o_EWGO-1suAY93CVPJq5EozX3XT9FUIRsTfutZQXQRmI/exec',

  // كلمة مرور المدير — غيّرها هنا فقط
  ADMIN_PASSWORD: 'admin123',

  // أسماء الأوراق — لا تغيّرها
  SHEETS: {
    MEMBERS:          'members',
    PENDING_REQUESTS: 'pending_requests',
    PENDING_UPDATES:  'pending_updates',
  },

  // إعدادات مظهر الشجرة
  LAYOUT: {
    NODE_WIDTH:    140,
    NODE_HEIGHT:   52,
    H_SPACING:     60,
    V_SPACING:     110,
  },

  LONG_PRESS_DURATION: 700,
};
