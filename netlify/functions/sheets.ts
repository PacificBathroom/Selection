import type { Handler } from "@netlify/functions";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!;
const DEFAULT_RANGE = "Products!A:ZZ";

function extractUrlFromImageFormula(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^=*\s*IMAGE\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
}
const normalizeCell = (v: unknown) => extractUrlFromImageFormula(v) ?? v;

function sheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

export const handler: Handler = async (event) => {
  try {
    const range =
      new URLSearchParams(event.queryStringParameters as any).get("range") ||
      DEFAULT_RANGE;

    const sheets = sheetsClient();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueRenderOption: "FORMULA",
    });

    const values = resp.data.values || [];
    if (!values.length) return { statusCode: 200, body: "[]" };

    const headers = (values[0] || []).map((h: any) => String(h ?? ""));
    const rows = values.slice(1).map((arr: unknown[]) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => (obj[h] = normalizeCell(arr[i])));
      return obj;
    });

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rows),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e?.message || "Sheets read error" }),
    };
  }
};
