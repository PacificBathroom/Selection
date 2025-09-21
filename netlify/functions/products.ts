import type { Handler } from "@netlify/functions";
import { google } from "googleapis";
import type { Product } from "../../src/types"; // adjust the path if needed

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!;
const RANGE = "Products!A:ZZ"; // <-- change if your tab name is different

/** Extract URL from =IMAGE("...") formula, otherwise return the string. */
function imageFromFormula(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^=*\s*IMAGE\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
}
const asImage = (v: unknown) => imageFromFormula(v) ?? (typeof v === "string" ? v.trim() : undefined);

/** Header aliases so your sheet can use friendly names */
const ALIASES: Record<string, keyof Product> = {
  // id is generated
  "name": "name",
  "product name": "name",
  "title": "name",

  "code": "code",
  "product code": "code",
  "sku": "sku",

  "category": "category",
  "type": "category",

  "url": "url",
  "product url": "url",
  "link": "url",

  "image": "imageUrl",
  "image url": "imageUrl",
  "imageurl": "imageUrl",
  "thumbnail": "thumbnailUrl",
  "thumbnail url": "thumbnailUrl",

  "pdf": "pdfUrl",
  "pdf url": "pdfUrl",
  "brochure": "pdfUrl",
  "spec pdf": "specPdfUrl",
  "specpdfurl": "specPdfUrl",

  "description": "description",
  "details": "description",

  "specs": "specs",
  "specifications": "specs",
  "spec bullets": "specs",

  "price": "price",
  "rrp": "price",
};

function authSheets() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

function normalizeHeaders(raw: unknown[]): string[] {
  return (raw || []).map(h => String(h ?? "").trim().toLowerCase());
}

function text(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function toNumber(v: unknown): number | null {
  const s = String(v ?? "").replace(/[, ]+/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitSpecs(v: unknown): string[] | undefined {
  if (Array.isArray(v)) {
    const arr = v.map(x => String(x ?? "").trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  }
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  // Accept either newline-separated or •/– bullet-separated text
  const parts = s.split(/\r?\n|•|–|-{1}\s/g).map(p => p.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

function makeId(p: Partial<Product>, idx: number): string {
  return (p.code || p.sku || p.url || p.name || `row-${idx + 2}`).toString();
}

function mapRow(headers: string[], row: unknown[], idx: number): Product {
  const draft: Partial<Product> = {};
  headers.forEach((h, i) => {
    const key = ALIASES[h] ?? (undefined as any);
    if (!key) return;
    const val = row[i];

    switch (key) {
      case "imageUrl":
      case "thumbnailUrl":
        (draft as any)[key] = asImage(val);
        break;
      case "price":
        draft.price = toNumber(val);
        break;
      case "specs":
        draft.specs = splitSpecs(val);
        break;
      default:
        (draft as any)[key] = text(val);
    }
  });

  const product: Product = {
    id: makeId(draft, idx),
    code: draft.code,
    sku: draft.sku,
    name: draft.name,
    category: draft.category,
    url: draft.url,
    imageUrl: draft.imageUrl,
    thumbnailUrl: draft.thumbnailUrl,
    pdfUrl: draft.pdfUrl,
    specPdfUrl: draft.specPdfUrl,
    description: draft.description,
    specs: draft.specs,
    price: draft.price ?? null,
  };
  return product;
}

export const handler: Handler = async (event) => {
  try {
    const q = (event.queryStringParameters?.q || "").toLowerCase();
    const category = (event.queryStringParameters?.category || "").toLowerCase();

    const sheets = authSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
      valueRenderOption: "FORMULA", // keep IMAGE("...") so we can extract URL
    });

    const values = res.data.values || [];
    if (!values.length) {
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: '{"items":[]}' };
    }

    const headerRow = normalizeHeaders(values[0]);
    let items = values.slice(1).map((row, i) => mapRow(headerRow, row, i));

    // Optional filters by query and category
    if (category) {
      items = items.filter(p => (p.category || "").toLowerCase() === category);
    }
    if (q) {
      items = items.filter(p => {
        const hay = [p.name, p.code, p.sku, p.category, p.description]
          .map(x => (x || "").toLowerCase())
          .join(" ");
        return hay.includes(q);
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ items }),
    };
  } catch (e: any) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: e?.message || "Sheets read error" }) };
  }
};
