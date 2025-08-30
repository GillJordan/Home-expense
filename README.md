# Expense Tracker Web App

Ye project ek simple **Expense Tracker Web Page** hai jo data directly **Google Sheet** me save karta hai.

---

## ⚡ Setup Instructions

### 1. Google Sheet + Apps Script
1. Ek Google Sheet banao (headers: Date, Credit, Debit, Product, For, Quantity, By, From, Timestamp).
2. `Extensions > Apps Script` me jao aur niche ka code paste karo:

```javascript
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({status: "ok", message: "App is running"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = JSON.parse(e.postData.contents);

  var dateObj = new Date(data.date);
  var year = dateObj.getFullYear().toString();

  var sheet = ss.getSheetByName(year);
  if (!sheet) {
    sheet = ss.insertSheet(year);
    sheet.appendRow(["Date", "Credit", "Debit", "Product", "For", "Quantity", "By", "From", "Timestamp"]);
  }

  sheet.appendRow([
    data.date,
    data.credit,
    data.debit,
    data.product,
    data.for,
    data.quantity,
    data.by,
    data.from,
    new Date()
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ "result": "success", "data": data }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Deploy → New Deployment → Type: **Web App**
   - Execute as: Me
   - Who has access: Anyone
4. Deploy → URL copy karo.

---

### 2. Frontend (index.html)
1. `index.html` me `scriptURL` variable me apna Google Apps Script Web App URL paste karo.
2. Is repo ko GitHub par upload karo.

---

### 3. Netlify Deploy
1. Netlify me login → "New Site from Git" → GitHub repo select karo.
2. Deploy karo → Netlify ek live URL dega.
3. Ab us link se world-wide kahin se bhi expense entry kar sakte ho 🚀

---

## ✅ Features
- Data auto save hota hai Google Sheet me.
- Year ke hisaab se alag sheet tab ban jati hai.
- Simple TailwindCSS based UI.
