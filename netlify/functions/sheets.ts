// netlify/functions/sheets.ts
import type { Handler } from "@netlify/functions";
import { google } from "googleapis";

const json = (status: number, body: unknown) => ({
  statusCode: status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event) => {
  try {
    const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID || "";
    const CLIENT_EMAIL   = process.env.GOOGLE_CLIENT_EMAIL || "";
    // Important: convert \n sequences to real newlines
    const PRIVATE_KEY    = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

    if (!SPREADSHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
      console.error("Sheets env missing", {
        hasId: !!SPREADSHEET_ID, hasEmail: !!CLIENT_EMAIL, hasKey: !!PRIVATE_KEY,
      });
      return json(500, { error: "Missing Google Sheets environment variables" });
    }

    const auth = new google.auth.JWT(
      CLIENT_EMAIL,
      undefined,
      PRIVATE_KEY,
      ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    // Allow ?range=..., default to your Products sheet
    const range = event.queryStringParameters?.range || "Products!A1:ZZ";
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const values = res.data.values || [];
    if (values.length === 0) return json(200, []);

    const [header, ...rows] = values;
    const out = rows.map((r) =>
      Object.fromEntries(header.map((h: string, i: number) => [h, r[i]]))
    );

    return json(200, out);
  } catch (err: any) {
    console.error("Sheets API error", { message: err?.message, stack: err?.stack });
    return json(500, { error: "Sheets API error 500" });
  }
};

export default handler;