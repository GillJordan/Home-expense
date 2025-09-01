const { google } = require("googleapis");

exports.handler = async (event, context) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID;

    // ✅ Suggestions request
    if (event.httpMethod === "GET" && event.queryStringParameters.suggestions) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let products = [],
        forList = [],
        byList = [],
        fromList = [];

      for (let sheetInfo of meta.data.sheets) {
        const sheetName = sheetInfo.properties.title;
        const read = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:M`,
        });

        const rows = read.data.values || [];
        rows.forEach((row, index) => {
          if (index === 0) return; // skip header
          if (row[5]) products.push(row[5]);
          if (row[6]) forList.push(row[6]);
          if (row[8]) byList.push(row[8]);
          if (row[9]) fromList.push(row[9]);
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

    // ✅ Search request
    if (event.httpMethod === "GET" && event.queryStringParameters.search) {
      const searchTerm = event.queryStringParameters.search.toLowerCase();
      const startDate = event.queryStringParameters.startDate
        ? new Date(event.queryStringParameters.startDate)
        : null;
      const endDate = event.queryStringParameters.endDate
        ? new Date(event.queryStringParameters.endDate)
        : null;

      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let allRows = [];

      for (let sheetInfo of meta.data.sheets) {
        const sheetName = sheetInfo.properties.title;
        const read = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:M`,
        });

        const rows = read.data.values || [];
        const filtered = rows.filter((row, index) => {
          if (index === 0) return false;
          const product = row[5] ? row[5].toLowerCase() : "";
          if (!product.includes(searchTerm)) return false;

          if (startDate || endDate) {
            const rowDate = new Date(row[1]);
            if (startDate && rowDate < startDate) return false;
            if (endDate && rowDate > endDate) return false;
          }
          return true;
        });

        allRows = allRows.concat(filtered);
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ data: allRows }),
      };
    }

    // ✅ Insert request
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body);
      const dateObj = new Date(body.date);
      const year = dateObj.getFullYear().toString();

      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      let sheetNames = meta.data.sheets.map((s) => s.properties.title);

      if (!sheetNames.includes(year)) {
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

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${year}!A:M`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[
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
          ]],
        },
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "✅ Data added successfully" }),
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (err) {
    console.error("❌ ERROR:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
