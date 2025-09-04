const { google } = require("googleapis");

/* ---------- Helpers ---------- */
function noCache() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Content-Type": "application/json"
  };
}
function resOk(obj)     { return { statusCode: 200, headers: noCache(), body: JSON.stringify(obj) }; }
function resErr(code,e) { return { statusCode: code, headers: noCache(), body: JSON.stringify({ error: e }) }; }

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

// ---- Parse service key (raw JSON OR base64(JSON)) + normalize private_key ----
function parseServiceKey(raw) {
  if (!raw) return null;
  let json = null;
  try { json = JSON.parse(raw); } catch (_) {
    try { json = JSON.parse(Buffer.from(raw, "base64").toString("utf8")); } catch (_) { }
  }
  if (!json) return null;

  // Normalize the private key so OpenSSL can parse it:
  // - If the value has literal "\n", convert to real newlines
  // - Remove any stray quotes/spaces around the PEM
  if (json.private_key) {
    let pk = json.private_key.trim();
    // if contains "\n" sequences, turn them into real newlines
    if (pk.includes("\\n")) pk = pk.replace(/\\n/g, "\n");
    // ensure proper PEM guards are intact
    if (!pk.includes("BEGIN PRIVATE KEY")) {
      // nothing else we can do; keep as is
    }
    json.private_key = pk;
  }
  return json;
}

async function getSheetsClient() {
  const creds = parseServiceKey(process.env.GOOGLE_SERVICE_KEY);
  if (!creds) throw new Error("GOOGLE_SERVICE_KEY not parsable (raw JSON or base64).");

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  return { sheets: google.sheets({ version: "v4", auth: client }) };
}

async function ensureYearSheet({ sheets, spreadsheetId, year }) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const has = meta.data.sheets?.find(s => s.properties?.title === year);
  if (has) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: year } } }] }
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${year}!A1:J1`,
    valueInputOption: "RAW",
    requestBody: { values: [[
      "Day","Date","Credit","Debit","Product","For","Quantity","By","From","Timestamp"
    ]] }
  });
}

/* ---------- MAIN HANDLER ---------- */
exports.handler = async (event) => {
  try {
    const spreadsheetId = process.env.SHEET_ID;
    if (!spreadsheetId) return resErr(500, "SHEET_ID missing");

    // Health
    if (event.queryStringParameters?.health === "1") {
      return resOk({ ok: true, msg: "function alive", method: event.httpMethod });
    }

    // Diagnostics
    if (event.queryStringParameters?.diag === "1") {
      try {
        const { sheets } = await getSheetsClient();
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const titles = (meta.data.sheets || []).map(s => s.properties?.title);
        return resOk({ ok: true, sheetId: spreadsheetId, tabs: titles });
      } catch (e) {
        return resErr(500, "Auth/Sheet error: " + (e.message || e.toString()));
      }
    }

    const { sheets } = await getSheetsClient();
    const now = new Date();
    const year = now.getFullYear().toString();

    // ALL
    if (event.queryStringParameters?.all === "true") {
      await ensureYearSheet({ sheets, spreadsheetId, year });
      const get = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${year}!A:J` });
      return resOk({ data: get.data.values || [] });
    }

    // DAILY
    if (event.queryStringParameters?.daily === "true") {
      const iso = event.queryStringParameters.date;
      if (!iso) return resErr(400, "daily=true needs ?date=YYYY-MM-DD");
      await ensureYearSheet({ sheets, spreadsheetId, year });
      const target = formatDate(iso);
      const get = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${year}!A:J` });
      const rows = (get.data.values || []).filter((r, i) => i !== 0 && r[1] === target);
      return resOk({ data: rows });
    }

    // SEARCH
    if (event.queryStringParameters?.search !== undefined) {
      const q = (event.queryStringParameters.search || "").toLowerCase();
      const { startDate, endDate } = event.queryStringParameters;
      await ensureYearSheet({ sheets, spreadsheetId, year });

      const get = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${year}!A:J` });
      let rows = (get.data.values || []).slice(1);
      if (q) rows = rows.filter(r => (r[4] || "").toLowerCase().includes(q)); // E=Product
      if (startDate && endDate) {
        const S = new Date(startDate), E = new Date(endDate);
        rows = rows.filter(r => { try { const d = new Date(r[1]); return d >= S && d <= E; } catch { return false; } });
      }
      const totalDebit = rows.reduce((s, r) => s + (parseFloat(r[3] || 0) || 0), 0);
      return resOk({ data: rows, totalDebit });
    }

    // POST
    if (event.httpMethod === "POST") {
      let body = null;
      try { body = JSON.parse(event.body || "{}"); } catch {}
      if (!body || !body.date) return resErr(400, "Body must include at least { date }");

      await ensureYearSheet({ sheets, spreadsheetId, year });

      const dateObj = new Date(body.date);
      if (isNaN(dateObj)) return resErr(400, "Invalid date");

      const row = [
        dateObj.toLocaleDateString("en-GB", { weekday: "long" }),
        formatDate(body.date),
        "",
        body.debit || "",
        body.product || "",
        body.for || "",
        body.quantity || "",
        body.by || "",
        body.from || "",
        new Date().toISOString()
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${year}!A:J`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] }
      });

      return resOk({ message: "Row added", row });
    }

    return resErr(405, "Method Not Allowed");
  } catch (err) {
    console.error("❌ Handler error:", err);
    return resErr(500, err.message || "Unknown error");
  }
};
