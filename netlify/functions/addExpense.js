const { google } = require("googleapis");

exports.handler = async (event) => {
  try {
    const sheets = google.sheets("v4");
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const client = await auth.getClient();
    const spreadsheetId = process.env.SHEET_ID;
    const year = new Date().getFullYear().toString();

    // ✅ ALL
    if (event.queryStringParameters?.all === "true") {
      const res = await sheets.spreadsheets.values.get({
        auth: client, spreadsheetId, range: `${year}!A:J`
      });
      return { statusCode: 200, body: JSON.stringify({ data: res.data.values || [] }) };
    }

    // ✅ DAILY
    if (event.queryStringParameters?.daily === "true") {
      const date = formatDate(event.queryStringParameters.date);
      const res = await sheets.spreadsheets.values.get({
        auth: client, spreadsheetId, range: `${year}!A:J`
      });
      const rows = res.data.values || [];
      const filtered = rows.filter(r => r[1] === date);
      return { statusCode: 200, body: JSON.stringify({ data: filtered }) };
    }

    // ✅ SEARCH
    if (event.queryStringParameters?.search !== undefined) {
      const query = (event.queryStringParameters.search || "").toLowerCase();
      const startDate = event.queryStringParameters.startDate;
      const endDate = event.queryStringParameters.endDate;

      const res = await sheets.spreadsheets.values.get({
        auth: client, spreadsheetId, range: `${year}!A:J`
      });
      let rows = res.data.values || [];

      if (query) rows = rows.filter(r => (r[4] || "").toLowerCase().includes(query));
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        rows = rows.filter(r => {
          try {
            const rowDate = new Date(r[1]);
            return rowDate >= start && rowDate <= end;
          } catch { return false; }
        });
      }

      const totalDebit = rows.reduce((s, r) => s + (parseFloat(r[3] || 0) || 0), 0);
      return { statusCode: 200, body: JSON.stringify({ data: rows, totalDebit }) };
    }

    // ✅ POST
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);
      const dateObj = new Date(body.date);
      const formattedDate = formatDate(body.date);

      const row = [
        dateObj.toLocaleDateString("en-GB", { weekday: "long" }),
        formattedDate,
        "", body.debit || "", body.product || "", body.for || "",
        body.quantity || "", body.by || "", body.from || "",
        new Date().toISOString()
      ];

      await sheets.spreadsheets.values.append({
        auth: client, spreadsheetId,
        range: `${year}!A:J`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] }
      });

      return { statusCode: 200, body: JSON.stringify({ message: "Row added", row }) };
    }

    return { statusCode: 400, body: "Invalid request" };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric"
  });
}
