# 🌳 Family Tree — Deployment Guide

A full-featured family tree web app with 600+ member support, Google Sheets as database, PWA support, and admin approval system.

---

## 📋 Google Sheets Structure

Create a new Google Sheet with **3 tabs** (exact names required):

### Tab 1: `members`

| Column | Description |
|--------|-------------|
| `id` | Unique ID (e.g. `M001`) |
| `name` | Full name |
| `parent_id` | Parent's `id` (blank for root) |
| `birth_date` | Optional (e.g. `1980-05-12`) |
| `phone` | Optional |
| `address` | Optional |
| `job` | Optional |
| `note` | Optional |

**Example rows:**
```
id,       name,             parent_id, birth_date,  phone, address,       job,      note
M001,     Ahmad Al-Hassan,  ,          1940-03-15,  ,      Baghdad Iraq,  Farmer,   Patriarch
M002,     Mohammed Hassan,  M001,      1965-07-10,  ,      ,              Engineer,
M003,     Fatima Hassan,    M001,      1967-02-20,  ,      ,              Teacher,
```

---

### Tab 2: `pending_requests`

| Column | Description |
|--------|-------------|
| `request_id` | Auto-generated |
| `type` | Always `add_child` |
| `parent_id` | Parent member id |
| `child_name` | Submitted child name |
| `birth_date` | Optional |
| `submitted_by` | Optional name |
| `status` | `pending` / `approved` / `rejected` |
| `timestamp` | Auto-generated |

Create this tab with just the header row — it will be auto-populated.

---

### Tab 3: `pending_updates`

| Column | Description |
|--------|-------------|
| `request_id` | Auto-generated |
| `member_id` | Target member id |
| `member_name` | For display |
| `birth_date` | New value (optional) |
| `phone` | New value (optional) |
| `address` | New value (optional) |
| `job` | New value (optional) |
| `note` | New value (optional) |
| `submitted_by` | Optional |
| `status` | `pending` / `approved` / `rejected` |
| `timestamp` | Auto-generated |

Create this tab with just the header row — it will be auto-populated.

---

## ⚙️ Google Apps Script Setup

1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete all existing code and paste the contents of `Code.gs`
3. Replace `YOUR_GOOGLE_SHEET_ID_HERE` in `Code.gs` with your actual Sheet ID  
   *(from the URL: `https://docs.google.com/spreadsheets/d/**SHEET_ID**/edit`)*
4. Click **Deploy → New Deployment**
5. Settings:
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy** and copy the **Web App URL**

---

## 🔧 Configure the Frontend

Open `js/config.js` and fill in:

```javascript
const CONFIG = {
  SHEET_ID: 'your-actual-sheet-id',
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_ID/exec',
  ADMIN_PASSWORD: 'yourSecurePassword',
  ...
};
```

---

## 🚀 Deploy to GitHub Pages

1. Create a new GitHub repository (public)
2. Upload all project files:
   ```
   index.html
   manifest.json
   service-worker.js
   css/style.css
   js/config.js
   js/sheets.js
   js/tree.js
   js/interactions.js
   js/search.js
   js/admin.js
   js/app.js
   icons/icon-192.png   ← add your own icons
   icons/icon-512.png   ← add your own icons
   ```
3. Go to **Settings → Pages**
4. Source: **Deploy from a branch**
5. Branch: **main**, folder: **/ (root)**
6. Click **Save**
7. Your site will be live at: `https://yourusername.github.io/repo-name/`

---

## 📱 PWA Icons

Create two PNG icon files and place them in the `icons/` folder:
- `icons/icon-192.png` — 192×192 pixels
- `icons/icon-512.png` — 512×512 pixels

You can use any free icon generator (e.g. [favicon.io](https://favicon.io)) with a tree emoji 🌳.

---

## 🌳 How to Use

### Adding the First Root Member
Manually add them in the `members` sheet with a blank `parent_id`.

### Single Click (or Tap)
Opens a side panel showing the person's details.

### Long Press (hold ~0.7s)
Shows a context menu:
- **👶 Add Child** — Submit a child (pending admin approval)
- **✏️ Add / Update Details** — Submit updated info (pending admin approval)

### Search
Type any part of a name (1, 2, or 3 words) in the search bar.  
Multiple matches show a selectable dropdown.

### Admin Panel
Click the ⚙ icon → enter password → Approve or Reject pending requests.  
Approved requests automatically update the tree.

---

## 🔒 Security Notes

- The admin password in `config.js` is visible in the browser.  
  For production, implement server-side auth in Apps Script.
- The Apps Script Web App is public (read/write) — consider adding a secret token parameter for write operations.

---

## 📊 Performance Tips for 600+ Members

- The tree uses a single-pass Reingold–Tilford layout (O(n) time)
- Nodes are plain `div` elements with absolute positioning
- SVG links are batch-rendered as a single `innerHTML` string
- Pan/zoom uses CSS `transform` — GPU accelerated
- Search results are limited to 20 matches with debouncing

For trees over 2000 members, consider virtualizing nodes (only render visible area).
