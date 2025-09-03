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

    // ✅ Return ALL entries for cache
    if (event.queryStringParameters?.all === "true") {
      const res = await sheets.spreadsheets.values.get({
        auth: client,
        spreadsheetId,
        range: `${year}!A:J`,
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ data: res.data.values || [] }),
      };
    }

    // ✅ Return DAILY entries
    if (event.queryStringParameters?.daily === "true") {
      const date = formatDate(event.queryStringParameters.date);
      const res = await sheets.spreadsheets.values.get({
        auth: client,
        spreadsheetId,
        range: `${year}!A:J`,
      });

      const rows = res.data.values || [];
      const filtered = rows.filter(r => r[1] === date); // Col B = Date
      return {
        statusCode: 200,
        body: JSON.stringify({ data: filtered }),
      };
    }

    // ✅ Return SEARCH entries
    if (event.queryStringParameters?.search !== undefined) {
      const query = event.queryStringParameters.search.toLowerCase();
      const startDate = event.queryStringParameters.startDate;
      const endDate = event.queryStringParameters.endDate;

      const res = await sheets.spreadsheets.values.get({
        auth: client,
        spreadsheetId,
        range: `${year}!A:J`,
      });

      let rows = res.data.values || [];

      // 🔹 Filter by product (Col E)
      if (query) {
        rows = rows.filter(r => (r[4] || "").toLowerCase().includes(query));
      }

      // 🔹 Filter by date range (Col B)
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        rows = rows.filter(r => {
          try {
            const rowDate = new Date(r[1]);
            return rowDate >= start && rowDate <= end;
          } catch {
            return false;
          }
        });
      }

      const totalDebit = rows.reduce((sum, r) => sum + (parseFloat(r[3] || 0) || 0), 0);

      return {
        statusCode: 200,
        body: JSON.stringify({ data: rows, totalDebit }),
      };
    }

    // ✅ POST new entry
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);
      const dateObj = new Date(body.date);
      const formattedDate = formatDate(body.date);

      const row = [
        dateObj.toLocaleDateString("en-GB", { weekday: "long" }), // Col A: Day
        formattedDate,                                           // Col B: Date
        "",                                                      // Col C: Credit blank
        body.debit || "",                                        // Col D: Debit
        body.product || "",                                      // Col E: Product
        body.for || "",                                          // Col F: For
        body.quantity || "",                                     // Col G: Quantity
        body.by || "",                                           // Col H: By
        body.from || "",                                         // Col I: From
        new Date().toISOString()                                 // Col J: Timestamp
      ];

      await sheets.spreadsheets.values.append({
        auth: client,
        spreadsheetId,
        range: `${year}!A:J`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Row added successfully", row }),
      };
    }

    return { statusCode: 400, body: "Invalid Request" };
  } catch (err) {
    console.error("❌ Backend Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// ✅ Helper - format date "01-September-2025"
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
