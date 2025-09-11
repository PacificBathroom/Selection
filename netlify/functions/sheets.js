// netlify/functions/sheets.js
const { google } = require("googleapis");

// normalize "row 1" labels -> snake_case keys
const toKey = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const ALIASES = {
  product: ["product", "name", "title"],
  sku: ["sku", "code"],
  thumbnail: ["thumbnail", "imageurl", "image_url", "image"],
  pdf_url: ["pdf_url", "pdfurl", "specpdfurl", "spec_pdf_url", "spec_pdf"],
  description: ["description", "desc"],
  category: ["category", "type"],
  source_url: ["source_url", "url", "link"],
  contact_name: ["contact_name", "contactname"],
  contact_email: ["contact_email", "contactemail", "email"],
  contact_phone: ["contact_phone", "contactphone", "phone"],
  contact_address: ["contact_address", "contactaddress", "address"],
  specs_bullets: ["specs_bullets", "specsbullets"],
};

const findKey = (obj, keys) => {
  for (const k of keys) if (k in obj) return obj[k];
  return undefined;
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS")
      return { statusCode: 200, headers: cors(), body: "ok" };

    const p = event.queryStringParameters || {};
    const q = String(p.q || "");
    const category = String(p.category || "");
    const debug = String(p.debug || "");
    // Accept either ?range=Tab!A1:ZZ or ?tab=Tab Name
    const tabParam = p.tab ? String(p.tab) : "";
    const rangeParam = p.range ? String(p.range) : "";

    const SHEET_ID = process.env.SHEET_ID;
    let credsJson = process.env.GOOGLE_CREDENTIALS;
    if (!credsJson && process.env.GOOGLE_CREDENTIALS_B64) {
      credsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, "base64").toString("utf8");
    }
    if (!SHEET_ID || !credsJson) {
      return json(500, { error: "Missing SHEET_ID or GOOGLE_CREDENTIALS(_B64)" });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credsJson),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const getTitles = async () => {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
      return (meta.data.sheets || [])
        .map((s) => s.properties && s.properties.title)
        .filter(Boolean);
    };
    const buildRange = (tabName) => {
      if (!tabName) return "A1:ZZ";
      const needsQuote = /[^A-Za-z0-9_]/.test(tabName);
      const quoted = needsQuote ? `'${tabName}'` : tabName;
      return `${quoted}!A1:ZZ`;
    };

    let range = rangeParam || (tabParam ? buildRange(tabParam) : "Products!A1:ZZ");
    let values;
    let availableSheets = [];
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range,
        valueRenderOption: "UNFORMATTED_VALUE",
      });
      values = resp.data.values || [];
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      if (/Unable to parse range|Range not found/i.test(msg)) {
        availableSheets = await getTitles();
        if (availableSheets.length) {
          range = buildRange(availableSheets[0]);
          const resp2 = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range,
            valueRenderOption: "UNFORMATTED_VALUE",
          });
          values = resp2.data.values || [];
        } else {
          return json(400, { error: "No sheets found in this spreadsheet.", debug: { msg } });
        }
      } else {
        throw e;
      }
    }

    if (!values || values.length === 0) {
      return json(200, {
        count: 0,
        items: [],
        debug: debug ? { rangeUsed: range, availableSheets } : undefined,
      });
    }

    const rawHeaders = values[0];
    const headers = rawHeaders.map(toKey);
    const rows = values.slice(1);

    // Build raw row objects keyed by normalized header
    const rawItems = rows.map((row) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = row[i] != null ? row[i] : ""));
      return obj;
    });

    // Canonicalize to app shape
    const items = rawItems.map((r) => {
      // convert SpecsBullets (string with newlines) -> specs array
      const rawSpecs = findKey(r, ALIASES.specs_bullets) || "";
      const specs =
        typeof rawSpecs === "string"
          ? rawSpecs
              .split(/\r?\n|\u2022/g) // split by newline or bullet char
              .map((s) => String(s).trim())
              .filter(Boolean)
          : undefined;

      return {
        product: findKey(r, ALIASES.product) || "",
        sku: findKey(r, ALIASES.sku) || "",
        thumbnail: findKey(r, ALIASES.thumbnail) || "",
        pdf_url: findKey(r, ALIASES.pdf_url) || "",
        description: findKey(r, ALIASES.description) || "",
        category: findKey(r, ALIASES.category) || "",
        source_url: findKey(r, ALIASES.source_url) || "",
        contact_name: findKey(r, ALIASES.contact_name) || "",
        contact_email: findKey(r, ALIASES.contact_email) || "",
        contact_phone: findKey(r, ALIASES.contact_phone) || "",
        contact_address: findKey(r, ALIASES.contact_address) || "",
        specs,
        _raw: r, // keep original keys for debugging if needed
      };
    });

    // Filters
    const qn = q.trim().toLowerCase();
    let filtered = items;
    if (qn) {
      const hit = (s) => String(s || "").toLowerCase().includes(qn);
      filtered = filtered.filter(
        (it) =>
          hit(it.product) ||
          hit(it.sku) ||
          hit(it.description) ||
          hit(it.category) ||
          hit(it.source_url) ||
          hit(it._raw?.name) || // just in case
          hit(it._raw?.code)
      );
    }
    const cat = category.trim().toLowerCase();
    if (cat) filtered = filtered.filter((it) => String(it.category || "").toLowerCase() === cat);

    return json(200, {
      count: filtered.length,
      items: filtered,
      debug: debug
        ? {
            rangeUsed: range,
            availableSheets,
            rawHeaders,
            normalizedHeaders: headers,
            sampleFirst3Items: filtered.slice(0, 3),
          }
        : undefined,
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e && e.message ? e.message : e) });
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}
function json(status, data) {
  return {
    statusCode: status,
    headers: { ...cors(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}
