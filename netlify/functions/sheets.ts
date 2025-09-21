// Minimal Sheets reader for Netlify (TypeScript)
// Reads rows and returns an array of objects (header row -> keys)

import { google } from "googleapis";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function toObjects(values?: string[][]) {
  if (!values || !values.length) return [];
  const [headers, ...rows] = values;
  return rows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))
  );
}

export const handler = async (event: any) => {
  try {
    const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID; // << set in Netlify
    if (!spreadsheetId) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: "Missing SHEETS_SPREADSHEET_ID" }),
      };
    }

    const range =
      (event.queryStringParameters && event.queryStringParameters.range) ||
      "Products!A:ZZ"; // default

    // service account creds from Netlify env
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
    if (!clientEmail || !privateKey) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: "Missing Google service account env vars" }),
      };
    }

    const jwt = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth: jwt });

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
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
        detail:
          e?.response?.data?.error?.message ||
          e?.message ||
          "Unknown error",
      }),
    };
  }
};