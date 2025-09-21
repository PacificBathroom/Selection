import type { Handler } from "@netlify/functions";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!;
const DEFAULT_RANGE = "Products!A:ZZ"; // adjust tab name/columns

const KEY_ALIASES: Record<string, string> = {
  url: "url",
  name: "name",
  code: "code",
  sku: "sku",
  category: "category",
  image: "image",
  imageurl: "imageUrl",
  thumbnail: "thumbnail",
  description: "description",
  pdfurl: "pdfUrl",
  "pdf url": "pdfUrl",
  specpdfurl: "specPdfUrl",
  specifications: "specifications",
  specs: "specs",
  specsbullets: "specs",
};

function normalizeRow(headers: string[], arr: unknown[]) {
  const out: any = {};
  headers.forEach((h, i) => {
    const keyNorm = KEY_ALIASES[h.toLowerCase()] || h;
    out[keyNorm] = arr[i] ?? "";
  });
  return out;
}

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
    const q = (event.queryStringParameters?.q || "").toLowerCase();
    const category = (event.queryStringParameters?.category || "").toLowerCase();

    const sheets = sheetsClient();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: DEFAULT_RANGE,
    });

    const values = resp.data.values || [];
    if (!values.length) return { statusCode: 200, body: '{"items":[]}' };

    const headers = (values[0] || []).map((h: any) => String(h ?? ""));
    let items = values.slice(1).map((arr) => normalizeRow(headers, arr));

    if (category) {
      items = items.filter(
        (r) => String(r.category || "").toLowerCase() === category
      );
    }

    if (q) {
      items = items.filter((r) => {
        const hay = [
          r.name,
          r.code,
          r.sku,
          r.category,
          r.description,
        ]
          .map((x) => String(x || "").toLowerCase())
          .join(" ");
        return hay.includes(q);
      });
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e?.message || "Sheets read error" }),
    };
  }
};
