const { google } = require("googleapis");
const toKey = (s) => String(s||"").trim().toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"");

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors(), body: "ok" };

    const { q = "", category = "", range = "Products!A1:ZZ" } = event.queryStringParameters || {};
    const creds = process.env.GOOGLE_CREDENTIALS, id = process.env.SHEET_ID;
    if (!creds || !id) return json(500, { error: "Missing GOOGLE_CREDENTIALS or SHEET_ID" });

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(creds),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: id, range, valueRenderOption: "UNFORMATTED_VALUE" });

    const values = resp.data.values || [];
    if (!values.length) return json(200, { items: [] });

    const headers = values[0].map(toKey);
    let items = values.slice(1).map(row => {
      const o = {}; headers.forEach((h,i)=>o[h] = row[i] ?? ""); return o;
    });

    const qn = q.toLowerCase().trim();
    if (qn) {
      const hit = (s) => String(s||"").toLowerCase().includes(qn);
      items = items.filter(it => hit(it.product)||hit(it.sku)||hit(it.description)||hit(it.category)||hit(it.client_name));
    }
    const cat = category.toLowerCase().trim();
    if (cat) items = items.filter(it => String(it.category||"").toLowerCase() === cat);

    return json(200, { count: items.length, items });
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e?.message||e) });
  }
};
const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});
const json = (statusCode, data) => ({ statusCode, headers: { ...cors(), "Content-Type":"application/json" }, body: JSON.stringify(data) });
