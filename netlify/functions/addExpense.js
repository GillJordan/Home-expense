const { google } = require("googleapis");

/* ---------- helpers ---------- */
function noCache() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Content-Type": "application/json"
  };
}
const ok  = (o) => ({ statusCode: 200, headers: noCache(), body: JSON.stringify(o) });
const err = (c,e) => ({ statusCode: c,   headers: noCache(), body: JSON.stringify({ error: e }) });

function formatDate(dStr){
  const d = new Date(dStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }); // e.g. 04 September 2025
}

// accept GOOGLE_SERVICE_KEY as raw JSON or base64(JSON), and normalize private_key
function parseServiceKey(raw){
  if(!raw) return null;
  let json=null;
  try{ json = JSON.parse(raw); }catch(_){
    try{ json = JSON.parse(Buffer.from(raw, "base64").toString("utf8")); }catch(_){}
  }
  if(!json) return null;
  if(json.private_key){
    let pk = json.private_key.trim();
    if(pk.includes("\\n")) pk = pk.replace(/\\n/g, "\n");
    json.private_key = pk;
  }
  return json;
}

async function sheetsClient(){
  const creds = parseServiceKey(process.env.GOOGLE_SERVICE_KEY);
  if(!creds) throw new Error("GOOGLE_SERVICE_KEY not parsable (raw JSON or base64).");
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

// create header exactly like your sheet (A–M)
async function ensureYearSheet({ sheets, spreadsheetId, year }){
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const has = meta.data.sheets?.find(s => s.properties?.title === year);
  if(has) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody:{ requests:[{ addSheet:{ properties:{ title: year } } }] }
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${year}!A1:M1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        "Day","Date","Credit","Left Balance","Debit","Product","For","Quantity","By","From","Extra Spent","Daily Limit","Remaining Limit"
      ]]
    }
  });
}

exports.handler = async (event)=>{
  try{
    const spreadsheetId = process.env.SHEET_ID;
    if(!spreadsheetId) return err(500,"SHEET_ID missing");

    // health+diag
    if(event.queryStringParameters?.health === "1"){
      return ok({ ok:true, msg:"function alive", method:event.httpMethod });
    }
    if(event.queryStringParameters?.diag === "1"){
      try{
        const sheets = await sheetsClient();
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const tabs = (meta.data.sheets||[]).map(s=>s.properties?.title);
        return ok({ ok:true, sheetId: spreadsheetId, tabs });
      }catch(e){ return err(500, "Auth/Sheet error: "+ (e.message||e.toString())); }
    }

    const sheets = await sheetsClient();
    const year = new Date().getFullYear().toString();
    await ensureYearSheet({ sheets, spreadsheetId, year });

    // get all (for debug)
    if(event.queryStringParameters?.all === "true"){
      const get = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${year}!A:M`});
      return ok({ data: get.data.values || [] });
    }

    // daily panel (Date is column B index 1)
    if(event.queryStringParameters?.daily === "true"){
      const iso = event.queryStringParameters.date;
      if(!iso) return err(400,"daily=true needs ?date=YYYY-MM-DD");
      const target = formatDate(iso);
      const get = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${year}!A:M`});
      const rows = (get.data.values||[]).filter((r,i)=> i!==0 && r[1] === target);
      return ok({ data: rows });
    }

    // search panel — map to your columns
    if(event.queryStringParameters?.search !== undefined){
      const q = (event.queryStringParameters.search || "").toLowerCase();
      const { startDate, endDate } = event.queryStringParameters;
      const get = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${year}!A:M`});
      let rows = (get.data.values||[]).slice(1); // skip header

      // E=Debit(index 4), F=Product(5)
      if(q) rows = rows.filter(r => (r[5] || "").toLowerCase().includes(q));
      if(startDate && endDate){
        const S = new Date(startDate), E = new Date(endDate);
        rows = rows.filter(r => { try{ const d=new Date(r[1]); return d>=S && d<=E; }catch{ return false; }});
      }
      const totalDebit = rows.reduce((s,r)=> s + (parseFloat(r[4]||0)||0), 0);
      return ok({ data: rows, totalDebit });
    }

    // add row (mapping A–M)
    if(event.httpMethod === "POST"){
      let body=null; try{ body = JSON.parse(event.body||"{}"); }catch{}
      if(!body || !body.date) return err(400,"Body must include at least { date }");

      const d = new Date(body.date);
      if(isNaN(d)) return err(400,"Invalid date");

      // A Day | B Date | C Credit | D LeftBal | E Debit | F Product | G For | H Qty | I By | J From | K Extra | L DL | M RL
      const values = [[
        d.toLocaleDateString("en-GB",{ weekday:"long" }),
        formatDate(body.date),
        "",                 // C Credit (blank)
        "",                 // D Left Balance (blank - formula)
        body.debit || "",   // E Debit
        body.product || "", // F Product
        body.for || "",     // G For
        body.quantity || "",// H Quantity
        body.by || "",      // I By
        body.from || "",    // J From
        "",                 // K Extra Spent (blank - formula/manual)
        "",                 // L Daily Limit (blank - formula)
        ""                  // M Remaining Limit (blank - formula)
      ]];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${year}!A:M`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values }
      });

      return ok({ message:"Row added", row: values[0] });
    }

    return err(405,"Method Not Allowed");
  }catch(e){
    console.error("handler error:", e);
    return err(500, e.message || "Unknown error");
  }
};
