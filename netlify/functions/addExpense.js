const { google } = require("googleapis");

exports.handler = async (event, context) => {
  try {
    // ✅ Google Auth
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.SHEET_ID;
    const sheetName = "2025"; // 👈 Year-wise sheet ka naam

    // ✅ SEARCH (GET request)
    if (event.httpMethod === "GET" && event.queryStringParameters.search) {
      const query = event.queryStringParameters.search.toLowerCase();

      // Get all rows
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:M` // Full columns
      });

      const rows = response.data.values || [];

      // Filter rows by product (column F → index 5)
      const filtered = rows.filter((row, index) => {
        if (index === 0) return false; // skip header
        return row[5] && row[5].toLowerCase().includes(query);
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ result: "success", data: filtered })
      };
    }

    // ✅ ADD ENTRY (POST request)
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);

      // Get last row
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:A`
      });
      const numRows = response.data.values ? response.data.values.length : 0;
      const nextRow = numRows + 1;

      // Format Day & Date
      const dateObj = new Date(body.date);
      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
      const formattedDate = `${String(dateObj.getDate()).padStart(2, "0")}-${dateObj.toLocaleString("en-US", { month: "long" })}-${dateObj.getFullYear()}`;

      // Insert row
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A${nextRow}`,
        valueInputOption: "RAW",
        resource: {
          values: [[
            dayName,          // A → Day
            formattedDate,    // B → Date
            "",               // C → Credit
            "",               // D → Left Balance
            body.debit,       // E → Debit
            body.product,     // F → Product
            body.for,         // G → For
            body.quantity,    // H → Quantity
            body.by,          // I → By
            body.from,        // J → From
            "",               // K → Extra Spent
            "",               // L → Daily Limit
            ""                // M → Remaining Limit
          ]]
        }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ result: "success", data: body })
      };
    }

    // ✅ If method not handled
    return {
      statusCode: 400,
      body: JSON.stringify({ result: "error", message: "Invalid request" })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ result: "error", message: err.message })
    };
  }
};
