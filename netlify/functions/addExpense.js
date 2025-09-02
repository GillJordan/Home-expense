const { google } = require("googleapis");

exports.handler = async (event, context) => {
  console.log("👉 Event received:", event.httpMethod, event.queryStringParameters);

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID;

    // ✅ Insert request
    if (event.httpMethod === "POST") {
      console.log("👉 POST body:", event.body);

      if (!event.body) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "❌ No body received" }),
        };
      }

      let body;
      try {
        body = JSON.parse(event.body);
      } catch (err) {
        console.error("❌ JSON parse error:", err);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid JSON body" }),
        };
      }

      console.log("👉 Parsed body:", body);

      const dateObj = new Date(body.date);
      if (isNaN(dateObj)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "❌ Invalid date" }),
        };
      }

      const year = dateObj.getFullYear().toString();

      // ✅ Ensure sheet exists
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let sheetNames = meta.data.sheets.map((s) => s.properties.title);
      console.log("👉 Existing sheets:", sheetNames);

      if (!sheetNames.includes(year)) {
        console.log("👉 Creating new sheet:", year);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title: year } } }] },
        });

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${year}!A1:M1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [[
              "Day","Date","Credit","Left Balance","Debit",
              "Product","For","Quantity","By","From",
              "Extra Spent","Daily Limit","Remaining Limit"
            ]],
          },
        });
      }

      const day = dateObj.toLocaleDateString("en-US", { weekday: "long" });

      const row = [
        day,
        body.date,
        "",
        "",
        body.debit,
        body.product,
        body.for,
        body.quantity,
        body.by,
        body.from,
        "",
        "",
        ""
      ];

      console.log("👉 Appending row:", row);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${year}!A:M`,
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });

      console.log("✅ Row added successfully");

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "✅ Data added successfully", row }),
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (err) {
    console.error("❌ ERROR:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
