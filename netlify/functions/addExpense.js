const { google } = require("googleapis");

exports.handler = async (event) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID;

    // ✅ Suggestions
    if (event.httpMethod === "GET" && "suggestions" in event.queryStringParameters) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let products = [], forList = [], byList = [], fromList = [];

      for (let s of meta.data.sheets) {
        const sheetName = s.properties.title;
        const read = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:M` });
        const rows = read.data.values || [];
        rows.forEach((row, i) => {
          if (i === 0) return;
          if (row[5]) products.push(row[5]);
          if (row[6]) forList.push(row[6]);
          if (row[8]) byList.push(row[8]);
          if (row[9]) fromList.push(row[9]);
        });
      }
      return { statusCode: 200, body: JSON.stringify({ data: { products: [...new Set(products)], forList: [...new Set(forList)], byList: [...new Set(byList)], fromList: [...new Set(fromList)] } }) };
    }

    // ✅ Daily data
    if (event.httpMethod === "GET" && event.queryStringParameters.daily) {
      const dateFilter = event.queryStringParameters.date;
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let allRows = [];

      for (let s of meta.data.sheets) {
        const sheetName = s.properties.title;
        const read = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:M` });
        const rows = read.data.values || [];
        const filtered = rows.filter((row, i) => i !== 0 && row[1] === dateFilter);
        allRows = allRows.concat(filtered);
      }
      return { statusCode: 200, body: JSON.stringify({ data: allRows }) };
    }

    // ✅ Insert
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);
      const dateObj = new Date(body.date);
      const year = dateObj.getFullYear().toString();

      // Format date → 01-September-2025
      const formattedDate = dateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      });

      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let sheetNames = meta.data.sheets.map(s => s.properties.title);
      if (!sheetNames.includes(year)) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title: year } } }] },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${year}!A1:M1`,
          valueInputOption: "RAW",
          requestBody: { values: [[
            "Day","Date","Credit","Left Balance","Debit","Product","For","Quantity","By","From","Extra Spent","Daily Limit","Remaining Limit"
          ]] },
        });
      }

      const day = dateObj.toLocaleDateString("en-US", { weekday: "long" });
      const row = [day, formattedDate, "", "", body.debit, body.product, body.for, body.quantity, body.by, body.from, "", "", ""];
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: `${year}!A:M`, valueInputOption: "RAW", requestBody: { values: [row] },
      });
      return { statusCode: 200, body: JSON.stringify({ message: "✅ Data added", row }) };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (err) {
    console.error("❌ ERROR:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
