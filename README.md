# 🌳 شجرة العائلة

## 📁 ترتيب الملفات على GitHub

```
your-repo/
│
├── index.html               ← الصفحة الرئيسية
├── manifest.json            ← إعدادات PWA
├── service-worker.js        ← العمل بدون إنترنت
│
├── css/
│   └── style.css
│
├── js/
│   ├── config.js            ← ⚙️ عدّل هذا أولاً
│   ├── sheets.js
│   ├── tree.js
│   ├── interactions.js
│   ├── search.js
│   ├── admin.js
│   └── app.js
│
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## ⚙️ الخطوة الأولى — تعديل config.js

افتح `js/config.js` وعدّل هذه القيم:

```javascript
SHEET_ID:        'ضع هنا ID الشيت',
APPS_SCRIPT_URL: 'ضع هنا رابط Apps Script',
ADMIN_PASSWORD:  'كلمة_السر',

// ⚠️ مهم جداً — اسم الـ repository على GitHub
// مثال: إذا كان الـ repo اسمه "family-tree" اكتب:
BASE_URL: '/family-tree/',

// إذا كان موقعك على domain خاص (مثل username.github.io فقط) اكتب:
BASE_URL: '/',
```

---

## 🚀 خطوات النشر على GitHub Pages

### 1. رفع الملفات
- أنشئ Repository جديد على github.com
- ارفع **كل الملفات والمجلدات** (مع المجلدات `js/` و`css/` و`icons/`)

### 2. تفعيل GitHub Pages
- اذهب إلى **Settings → Pages**
- اختر **Branch: main** ثم **/ (root)**
- اضغط **Save**

### 3. انتظر دقيقة ثم افتح الرابط
`https://اسم_المستخدم.github.io/اسم_الريبو/`

---

## 📱 تثبيت التطبيق على الهاتف

بعد فتح الموقع:
- **أندرويد**: اضغط على القائمة ← "إضافة إلى الشاشة الرئيسية"
- **آيفون**: اضغط على زر المشاركة ← "إضافة إلى الشاشة الرئيسية"

---

## 🌳 هيكل Google Sheets

### ورقة `members`
| id | name | parent_id | birth_date | phone | address | job | note |
|----|------|-----------|------------|-------|---------|-----|------|
| M001 | أحمد محمد | | 1940-01-01 | | بغداد | مزارع | |
| M002 | علي أحمد | M001 | 1965-05-10 | | | مهندس | |

### ورقة `pending_requests`
اتركها فارغة مع الترويسات:
`request_id | type | parent_id | child_name | birth_date | submitted_by | status | timestamp`

### ورقة `pending_updates`
اتركها فارغة مع الترويسات:
`request_id | member_id | member_name | birth_date | phone | address | job | note | submitted_by | status | timestamp`

---

## ❗ حل مشكلة 404 على الهاتف

المشكلة كانت في `manifest.json` — الآن تم تصحيحها باستخدام مسارات نسبية:
```json
"start_url": "./index.html",
"scope": "./"
```

وفي `service-worker.js` أيضاً تم استخدام `./` بدلاً من `/`.
