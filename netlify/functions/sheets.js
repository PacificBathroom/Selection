// netlify/functions/sheets.js
const { google } = require("googleapis");

// normalize header -> key
const toKey = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

exports.handler = async (event) => {
  try {
    // CORS + preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: "ok",
      };
    }

    const params = event.queryStringParameters || {};
    const { q = "", category = "", limit = "0", range = "Products!A1:ZZ", debug = "" } = params;

    const sheetId = process.env.SHEET_ID;
    let credsJson = process.env.GOOGLE_CREDENTIALS;
    if (!credsJson && process.env.GOOGLE_CREDENTIALS_B64) {
      credsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, "base64").toString("utf8");
    }

    if (!sheetId || !credsJson) {
      return json(500, { error: "Missing SHEET_ID or GOOGLE_CREDENTIALS/GOOGLE_CREDENTIALS_B64" });
    }

    // auth
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credsJson),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    // fetch rows
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const values = resp.data.values || [];
    if (values.length === 0) {
      return json(200, {
        count: 0,
        items: [],
        debug: debug ? { note: "No values returned for this range.", range } : undefined,
      });
    }

    const rawHeaders = values[0];
    const headers = rawHeaders.map(toKey);
    const rows = values.slice(1);

    let items = rows.map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] != null ? row[i] : "";
      });
      return obj;
    });

    // filters
    const qNorm = String(q).trim().toLowerCase();
    if (qNorm) {
      const hit = (s) => String(s || "").toLowerCase().includes(qNorm);
      items = items.filter(
        (it) =>
          hit(it.product) ||
          hit(it.sku) ||
          hit(it.description) ||
          hit(it.category) ||
          hit(it.client_name)
      );
    }

    const cat = String(category).trim().toLowerCase();
    if (cat) {
      items = items.filter((it) => String(it.category || "").toLowerCase() === cat);
    }

    const lim = parseInt(limit, 10);
    if (!Number.isNaN(lim) && lim > 0) items = items.slice(0, lim);

    return json(200, {
      count: items.length,
      items,
      debug: debug
        ? {
            rangeUsed: range,
            rawHeaders,
            normalizedHeaders: headers,
            sampleFirst3RawRows: rows.slice(0, 3),
            sampleFirst3Items: items.slice(0, 3),
            note:
              "If fields in items are empty, check your header names in row 1 match what the app expects (Product, Category, Thumbnail, Description, Client Name, PDF URL, SKU).",
          }
        : undefined,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: String(err && err.message ? err.message : err) });
  }
};

// helpers
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // avoid caching while debugging
    "Cache-Control": "no-store",
  };
}

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };
}
