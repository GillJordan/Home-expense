const { google } = require("googleapis");

exports.handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS), // Service Account JSON
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });
    const sheetId = process.env.SHEET_ID; // Google Sheet ID

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "2025!A1",
      valueInputOption: "RAW",
      resource: {
        values: [[
          body.date, body.credit, body.debit, body.product,
          body.for, body.quantity, body.by, body.from,
          new Date().toISOString()
        ]]
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ result: "success", data: body })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ result: "error", message: err.message })
    };
  }
};
