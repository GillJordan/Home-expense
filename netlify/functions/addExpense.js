const { google } = require("googleapis");

exports.handler = async (event, context) => {
  try {
    console.log("👉 Incoming Event Body:", event.body);

    const body = JSON.parse(event.body);

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.SHEET_ID;
    const sheetName = "2025"; // 👈 apna sheet ka naam yaha fix kar (year wise)

    // 🔹 Get last used row number
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A:A`
    });

    const numRows = response.data.values ? response.data.values.length : 0;
    const nextRow = numRows + 1;

    console.log("👉 Writing at row:", nextRow);

    // 🔹 Write data to next row
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${sheetName}!A${nextRow}`,
      valueInputOption: "RAW",
      resource: {
        values: [[
          body.date, body.credit, body.debit, body.product,
          body.for, body.quantity, body.by, body.from,
          new Date().toISOString()
        ]]
      }
    });

    console.log("✅ Data Added Successfully");

    return {
      statusCode: 200,
      body: JSON.stringify({ result: "success", row: nextRow, data: body })
    };

  } catch (err) {
    console.error("❌ Error in addExpense:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ result: "error", message: err.message })
    };
  }
};
