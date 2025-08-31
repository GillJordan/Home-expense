const { google } = require("googleapis");

exports.handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.SHEET_ID;
    const sheetName = "2025"; // 👈 apne year ke hisaab se sheet ka naam

    // Get last used row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:A`
    });
    const numRows = response.data.values ? response.data.values.length : 0;
    const nextRow = numRows + 1;

    // Day calculate from date
    const dayName = new Date(body.date).toLocaleDateString("en-US", { weekday: "long" });

    // Insert row according to column mapping
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${sheetName}!A${nextRow}`,
      valueInputOption: "RAW",
      resource: {
        values: [[
          dayName,          // A → Day
          body.date,        // B → Date
          "",               // C → Credit (empty)
          "",               // D → Left Balance (empty)
          body.debit,       // E → Debit
          body.product,     // F → Product
          body.for,         // G → For
          body.quantity,    // H → Quantity
          body.by,          // I → By
          body.from,        // J → From
          "",               // K → Extra Spent (formula)
          "",               // L → Daily Limit (formula)
          ""                // M → Remaining Limit (formula)
        ]]
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ result: "success", row: nextRow, data: body })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ result: "error", message: err.message })
    };
  }
};
