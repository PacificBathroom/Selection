// netlify/functions/sheets.ts
import type { Handler } from "@netlify/functions";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!; // set in Netlify env
const DEFAULT_RANGE = "Products!A:ZZ";

// IMAGE("url", ...) formula parser → returns the first quoted URL if present
function extractUrlFromImageFormula(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  // Handles =IMAGE("...") and =IMAGE("...", 1) etc.
  const m = s.match(/^=*\s*IMAGE\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
}

function normalizeCell(v: unknown): unknown {
  // If it looks like =IMAGE("..."), convert to the URL string
  const imageUrl = extractUrlFromImageFormula(v);
  if (imageUrl) return imageUrl;

  // Pass everything else through
  return v;
}

function authSheets() {
  const client = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth: client });
}

export const handler: Handler = async (event) => {
  try {
    const qs = new URLSearchParams(event.queryStringParameters as any);
    const range = qs.get("range") || DEFAULT_RANGE;

    const sheets = authSheets();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
      // We want raw values or formulas, not the rendered image blob
      valueRenderOption: "FORMULA",
    });

    const values = resp.data.values || [];
    if (!values.length) {
      return { statusCode: 200, body: "[]" };
    }

    const headers = (values[0] || []).map((h: any) => String(h ?? ""));
    const rows = values.slice(1).map((arr: unknown[]) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = normalizeCell(arr[i]);
      });
      return obj;
    });

    return {
      statusCode: 200,
      headers: { "content-type": "application/json", "cache-control": "no-cache" },
      body: JSON.stringify(rows),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e?.message || "Sheets read error" }),
    };
  }
};
