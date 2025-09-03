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

    // ✅ Test only: Add row to sheet
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);
      const dateObj = new Date(body.date);
      const formattedDate = formatDate(body.date);

      const row = [
        dateObj.toLocaleDateString("en-GB", { weekday: "long" }), // Day
        formattedDate,                                           // Date
        "",                                                      // Credit blank
        body.debit || "",                                        // Debit
        body.product || "",                                      // Product
        body.for || "",                                          // For
        body.quantity || "",                                     // Quantity
        body.by || "",                                           // By
        body.from || "",                                         // From
        new Date().toISOString()                                 // Timestamp
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

    return { statusCode: 200, body: "API running, but only POST supported now" };

  } catch (err) {
    console.error("❌ Backend Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
