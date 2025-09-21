// netlify/functions/sheets.ts
// Minimal Sheets reader for Netlify (TypeScript)

import { google } from "googleapis";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function toObjects(values?: string[][]) {
  if (!values || !values.length) return [];
  const [headers, ...rows] = values;
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

export const handler = async (event: any) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  try {
    const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: "Missing SHEETS_SPREADSHEET_ID" }),
      };
    }

    // Accept ?range=… (default to your Products sheet)
    const range = event.queryStringParameters?.range ?? "Products!A:ZZ";

    // Service account creds from env
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || "";
    let key = process.env.GOOGLE_PRIVATE_KEY || "";
    // normalize: strip surrounding quotes, convert \n to real newlines if present
    key = key.trim();
    if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
    key = key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;

    if (!clientEmail || !key) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: "Missing Google service account env vars" }),
      };
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    const rows = toObjects(resp.data.values as any);
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify(rows),
    };
  } catch (e: any) {
    console.error("Sheets error:", e?.response?.data || e?.message || e);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Sheets API error",
        detail: e?.response?.data?.error?.message || e?.message || "Unknown error",
      }),
    };
  }
};