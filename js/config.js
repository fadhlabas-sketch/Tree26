/**
 * config.js
 * =========
 * Central configuration for the Family Tree app.
 * ⚠️  EDIT THESE VALUES before deploying.
 */

const CONFIG = {
  /**
   * Your Google Sheet ID.
   * Found in the sheet URL:
   *   https://docs.google.com/spreadsheets/d/  <SHEET_ID>  /edit
   */
  SHEET_ID: '1Tiwmo70s2mtXRykEKnqRv_bHTIpp-sTQ-KwtS2xghLM',

  /**
   * Your Google Apps Script Web App URL.
   * Deploy the provided Code.gs as a Web App and paste the URL here.
   */
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxLnajWmvokIIYTiyXIj9lF_akeYNQS_qhbzQ6hhdJCD0cco7K2EgbrOD0SYPRJAew/exec',

  /**
   * Admin password (stored only client-side for simplicity).
   * For production, handle authentication in Apps Script.
   */
  ADMIN_PASSWORD: 'admin123',

  /**
   * Sheet tab names (must match exactly).
   */
  SHEETS: {
    MEMBERS:          'members',
    PENDING_REQUESTS: 'pending_requests',
    PENDING_UPDATES:  'pending_updates',
  },

  /**
   * Visual layout settings.
   */
  LAYOUT: {
    NODE_WIDTH:    140,
    NODE_HEIGHT:   52,
    H_SPACING:     60,   // horizontal gap between siblings
    V_SPACING:     110,  // vertical gap between generations
  },

  /**
   * Long-press duration in milliseconds.
   */
  LONG_PRESS_DURATION: 700,
};
