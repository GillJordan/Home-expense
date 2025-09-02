const { google } = require("googleapis");

exports.handler = async (event) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID;

    // ✅ Insert Data
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);
      const dateObj = new Date(body.date);
      if (isNaN(dateObj)) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid Date" }) };
      }

      const year = dateObj.getFullYear().toString();

      // Format date → 01-September-2025
      const formattedDate = dateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      // Ensure year sheet exists
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let sheet = meta.data.sheets.find((s) => s.properties.title === year);

      if (!sheet) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: year } } }],
          },
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

        // Reload sheet info
        const newMeta = await sheets.spreadsheets.get({ spreadsheetId });
        sheet = newMeta.data.sheets.find((s) => s.properties.title === year);
      }

      const sheetId = sheet.properties.sheetId;

      const day = dateObj.toLocaleDateString("en-US", { weekday: "long" });
      const row = [
        day, formattedDate, "", "", body.debit,
        body.product, body.for, body.quantity, body.by, body.from,
        "", "", ""
      ];

      console.log("👉 Trying to append row:", row);

      const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${year}!A:M`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });

      console.log("👉 Append response:", appendRes.data);

      if (!appendRes.data.updates || appendRes.data.updates.updatedRows === 0) {
        throw new Error("❌ Row not appended, check request format");
      }

      // ✅ Now get last row count for formula dragdown
      const read = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${year}!A:M`,
      });
      const lastRow = read.data.values.length;

      // ✅ Copy only formula columns (C:D and L:M)
      if (lastRow > 2) {
        const formulaColumns = [
          { start: 2, end: 4 },   // C:D (Credit, Left Balance)
          { start: 11, end: 13 }, // L:M (Daily Limit, Remaining Limit)
        ];

        for (let col of formulaColumns) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  copyPaste: {
                    source: {
                      sheetId,
                      startRowIndex: lastRow - 2,
                      endRowIndex: lastRow - 1,
                      startColumnIndex: col.start,
                      endColumnIndex: col.end,
                    },
                    destination: {
                      sheetId,
                      startRowIndex: lastRow - 1,
                      endRowIndex: lastRow,
                      startColumnIndex: col.start,
                      endColumnIndex: col.end,
                    },
                    pasteType: "PASTE_FORMULA",
                  },
                },
              ],
            },
          });
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "✅ Data added", row }),
      };
    }

    // ✅ Suggestions
    if (event.httpMethod === "GET" && "suggestions" in event.queryStringParameters) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let products = [], forList = [], byList = [], fromList = [];

      for (let s of meta.data.sheets) {
        const sheetName = s.properties.title;
        const read = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:M`,
        });
        const rows = read.data.values || [];
        rows.forEach((r, i) => {
          if (i === 0) return;
          if (r[5]) products.push(r[5]);
          if (r[6]) forList.push(r[6]);
          if (r[8]) byList.push(r[8]);
          if (r[9]) fromList.push(r[9]);
        });
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          data: {
            products: [...new Set(products)],
            forList: [...new Set(forList)],
            byList: [...new Set(byList)],
            fromList: [...new Set(fromList)],
          },
        }),
      };
    }

    // ✅ Daily data
    if (event.httpMethod === "GET" && event.queryStringParameters.daily) {
      const dateFilter = event.queryStringParameters.date;
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let allRows = [];

      for (let s of meta.data.sheets) {
        const sheetName = s.properties.title;
        const read = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:M`,
        });
        const rows = read.data.values || [];
        const filtered = rows.filter((r, i) => i !== 0 && r[1] === dateFilter);
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
