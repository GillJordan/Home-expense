const { google } = require("googleapis");

// ---- helpers ----
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  return { sheets: google.sheets({ version: "v4", auth: client }), auth: client };
}
async function ensureYearSheet({ sheets, spreadsheetId, year }) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  let tab = meta.data.sheets.find(s => s.properties.title === year);
  if (!tab) {
    // create sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: year } } }] }
    });
    // header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${year}!A1:J1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          "Day","Date","Credit","Debit","Product","For","Quantity","By","From","Timestamp"
        ]]
      }
    });
  }
}

exports.handler = async (event) => {
  try {
    // health check
    if (event.queryStringParameters && event.queryStringParameters.health === "1") {
      return { statusCode: 200, headers: noCache(), body: JSON.stringify({ ok: true, msg: "function alive" }) };
    }

    const spreadsheetId = process.env.SHEET_ID;
    if (!process.env.GOOGLE_SERVICE_KEY || !spreadsheetId) {
      return resErr(500, "Missing env vars: GOOGLE_SERVICE_KEY or SHEET_ID not set in Netlify.");
    }

    const { sheets } = await getSheetsClient();
    const now = new Date();
    const currentYear = now.getFullYear().toString();

    // -------- ALL (for offline cache preload) --------
    if (event.queryStringParameters?.all === "true") {
      await ensureYearSheet({ sheets, spreadsheetId, year: currentYear });
      const get = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${currentYear}!A:J`
      });
      return resOk({ data: get.data.values || [] });
    }

    // -------- DAILY --------
    if (event.queryStringParameters?.daily === "true") {
      const dateISO = event.queryStringParameters.date;
      if (!dateISO) return resErr(400, "daily=true needs ?date=YYYY-MM-DD");
      await ensureYearSheet({ sheets, spreadsheetId, year: currentYear });

      const target = formatDate(dateISO);
      const get = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${currentYear}!A:J`
      });
      const rows = (get.data.values || []).filter((r, i) => i === 0 ? false : (r[1] === target));
      return resOk({ data: rows });
    }

    // -------- SEARCH --------
    if (event.queryStringParameters?.search !== undefined) {
      const q = (event.queryStringParameters.search || "").toLowerCase();
      const { startDate, endDate } = event.queryStringParameters;

      await ensureYearSheet({ sheets, spreadsheetId, year: currentYear });

      const get = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${currentYear}!A:J`
      });
      let rows = (get.data.values || []).slice(1); // skip header

      if (q) rows = rows.filter(r => (r[4] || "").toLowerCase().includes(q));   // E = Product
      if (startDate && endDate) {
        const s = new Date(startDate), e = new Date(endDate);
        rows = rows.filter(r => {
          try { const d = new Date(r[1]); return d >= s && d <= e; } catch { return false; }
        });
      }
      const totalDebit = rows.reduce((sum, r) => sum + (parseFloat(r[3] || 0) || 0), 0); // D = Debit
      return resOk({ data: rows, totalDebit });
    }

    // -------- POST (add row) --------
    if (event.httpMethod === "POST") {
      const body = safeJSON(event.body);
      if (!body || !body.date) return resErr(400, "Body must include at least { date }");

      await ensureYearSheet({ sheets, spreadsheetId, year: currentYear });

      const dateObj = new Date(body.date);
      if (isNaN(dateObj)) return resErr(400, "Invalid date");

      const row = [
        dateObj.toLocaleDateString("en-GB", { weekday: "long" }), // A Day
        formatDate(body.date),                                    // B Date
        "",                                                       // C Credit
        body.debit || "",                                         // D Debit
        body.product || "",                                       // E Product
        body.for || "",                                           // F For
        body.quantity || "",                                      // G Quantity
        body.by || "",                                            // H By
        body.from || "",                                          // I From
        new Date().toISOString()                                  // J Timestamp
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${currentYear}!A:J`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] }
      });

      return resOk({ message: "Row added", row });
    }

    return resErr(405, "Method Not Allowed");
  } catch (err) {
    console.error("❌ Function Error:", err);
    return resErr(500, err.message || "Unknown error");
  }
};

// ---- response helpers (with no-cache) ----
function noCache() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Content-Type": "application/json"
  };
}
function resOk(obj) { return { statusCode: 200, headers: noCache(), body: JSON.stringify(obj) }; }
function resErr(code, msg) { return { statusCode: code, headers: noCache(), body: JSON.stringify({ error: msg }) }; }
function safeJSON(s) { try { return JSON.parse(s || "{}"); } catch { return null; } }
