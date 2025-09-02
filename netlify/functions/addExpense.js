const { google } = require("googleapis");

exports.handler = async (event) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID;

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

      // Ensure sheet exists
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let sheet = meta.data.sheets.find(s => s.properties.title === year);
      if (!sheet) {
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
        sheet = (await sheets.spreadsheets.get({ spreadsheetId })).data.sheets.find(s => s.properties.title === year);
      }

      const sheetId = sheet.properties.sheetId;
      const day = dateObj.toLocaleDateString("en-US", { weekday: "long" });
      const row = [day, formattedDate, "", "", body.debit, body.product, body.for, body.quantity, body.by, body.from, "", "", ""];

      // Append row
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: `${year}!A:M`, valueInputOption: "RAW", requestBody: { values: [row] },
      });

      // Get row count for formula copy
      const read = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${year}!A:M` });
      const lastRow = read.data.values.length;

      // Drag down formulas from previous row (C–M i.e. 3rd to 13th column)
      if (lastRow > 2) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              copyPaste: {
                source: { sheetId, startRowIndex: lastRow-2, endRowIndex: lastRow-1, startColumnIndex: 2, endColumnIndex: 13 },
                destination: { sheetId, startRowIndex: lastRow-1, endRowIndex: lastRow, startColumnIndex: 2, endColumnIndex: 13 },
                pasteType: "PASTE_FORMULA"
              }
            }]
          }
        });
      }

      return { statusCode: 200, body: JSON.stringify({ message: "✅ Data added", row }) };
    }

    // ✅ Suggestions
    if (event.httpMethod === "GET" && "suggestions" in event.queryStringParameters) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let products = [], forList = [], byList = [], fromList = [];
      for (let s of meta.data.sheets) {
        const sheetName = s.properties.title;
        const read = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:M` });
        const rows = read.data.values || [];
        rows.forEach((r,i) => {
          if (i === 0) return;
          if (r[5]) products.push(r[5]);
          if (r[6]) forList.push(r[6]);
          if (r[8]) byList.push(r[8]);
          if (r[9]) fromList.push(r[9]);
        });
      }
      return { statusCode: 200, body: JSON.stringify({ data: { products:[...new Set(products)], forList:[...new Set(forList)], byList:[...new Set(byList)], fromList:[...new Set(fromList)] } }) };
    }

    // ✅ Daily
    if (event.httpMethod === "GET" && event.queryStringParameters.daily) {
      const dateFilter = event.queryStringParameters.date;
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let allRows = [];
      for (let s of meta.data.sheets) {
        const sheetName = s.properties.title;
        const read = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:M` });
        const rows = read.data.values || [];
        const filtered = rows.filter((r,i) => i !== 0 && r[1] === dateFilter);
        allRows = allRows.concat(filtered);
      }
      return { statusCode: 200, body: JSON.stringify({ data: allRows }) };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (err) {
    console.error("❌ ERROR:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
