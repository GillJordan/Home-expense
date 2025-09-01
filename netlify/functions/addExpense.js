const { google } = require("googleapis");

exports.handler = async (event, context) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.SHEET_ID;

    /* ----------------------
       ✅ Get Suggestions
    ---------------------- */
    if (event.httpMethod === "GET" && event.queryStringParameters.suggestions) {
      const sheetName = event.queryStringParameters.sheet || new Date().getFullYear().toString();

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:M`
      });

      const rows = res.data.values || [];

      const productSet = new Set();
      const forSet = new Set();
      const bySet = new Set();
      const fromSet = new Set();

      rows.forEach((row, index) => {
        if (index === 0) return; // skip header
        if (row[5]) productSet.add(row[5]); // Product (F)
        if (row[6]) forSet.add(row[6]);     // For (G)
        if (row[8]) bySet.add(row[8]);      // By (I)
        if (row[9]) fromSet.add(row[9]);    // From (J)
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          result: "success",
          data: {
            products: [...productSet],
            forList: [...forSet],
            byList: [...bySet],
            fromList: [...fromSet]
          }
        })
      };
    }

    /* ----------------------
       ✅ Search by Product
    ---------------------- */
    if (event.httpMethod === "GET" && event.queryStringParameters.search) {
      const sheetName = event.queryStringParameters.sheet || new Date().getFullYear().toString();
      const query = event.queryStringParameters.search.toLowerCase();

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:M`
      });

      const rows = response.data.values || [];
      const filtered = rows.filter((row, index) => {
        if (index === 0) return false;
        return row[5] && row[5].toLowerCase().includes(query);
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ result: "success", data: filtered })
      };
    }

    /* ----------------------
       ✅ Add Entry (POST)
    ---------------------- */
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);
      const sheetName = body.sheetName || new Date().getFullYear().toString();

      // Get last row
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:A`
      });
      const numRows = response.data.values ? response.data.values.length : 0;
      const nextRow = numRows + 1;

      // Format date
      const dateObj = new Date(body.date);
      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
      const formattedDate = `${String(dateObj.getDate()).padStart(2, "0")}-${dateObj.toLocaleString("en-US", { month: "long" })}-${dateObj.getFullYear()}`;

      // Insert into expense sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A${nextRow}`,
        valueInputOption: "RAW",
        resource: {
          values: [[
            dayName, formattedDate, "", "", body.debit,
            body.product, body.for, body.quantity,
            body.by, body.from, "", "", ""
          ]]
        }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ result: "success", data: body })
      };
    }

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
