import type { Handler } from "@netlify/functions";
import { google } from "googleapis";
import type { Product } from "../../src/types";

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!;
const RANGE = "Products!A:ZZ"; // ok to leave wide; or tighten to A:M

// Pull URL out of =IMAGE("...") formulas
function imageFromFormula(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^=*\s*IMAGE\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
}
const asImage = (v: unknown) => imageFromFormula(v) ?? (typeof v === "string" ? v.trim() : undefined);
const asText  = (v: unknown) => (v == null ? undefined : String(v).trim() || undefined);

function splitSpecs(v: unknown): string[] | undefined {
  if (Array.isArray(v)) {
    const arr = v.map(x => String(x ?? "").trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  }
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  // allow newline or bullet separators
  const parts = s.split(/\r?\n|•|–|—|-\s/g).map(p => p.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

function sheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

// exact header mapping for your sheet (case-insensitive, trimmed)
const H = {
  url: "url",
  code: "code",
  name: "name",
  imageurl: "imageurl",
  description: "description",
  specsbullets: "specsbullets",
  pdfurl: "pdfurl",
  contactname: "contactname",
  contactemail: "contactemail",
  contactphone: "contactphone",
  contactaddress: "contactaddress",
  category: "category",
} as const;

function normalizeHeaders(raw: unknown[]): string[] {
  return (raw || []).map(h => String(h ?? "").trim().toLowerCase());
}

function makeId(p: Partial<Product>, idx: number): string {
  return (p.code || p.url || p.name || `row-${idx + 2}`).toString();
}

function mapRow(headers: string[], row: unknown[], idx: number): Product {
  // build a quick lookup: header -> cell value
  const cells: Record<string, unknown> = {};
  headers.forEach((h, i) => (cells[h] = row[i]));

  const product: Product = {
    id: makeId(
      { code: asText(cells[H.code]), url: asText(cells[H.url]), name: asText(cells[H.name]) },
      idx
    ),
    url: asText(cells[H.url]),
    code: asText(cells[H.code]),
    name: asText(cells[H.name]),
    imageUrl: asImage(cells[H.imageurl]),
    description: asText(cells[H.description]),
    specs: splitSpecs(cells[H.specsbullets]),
    pdfUrl: asText(cells[H.pdfurl]),
    category: asText(cells[H.category]),
    contact: {
      name: asText(cells[H.contactname]),
      email: asText(cells[H.contactemail]),
      phone: asText(cells[H.contactphone]),
      address: asText(cells[H.contactaddress]),
    },
  };

  // if contact is all empty, drop it
  if (
    !product.contact?.name &&
    !product.contact?.email &&
    !product.contact?.phone &&
    !product.contact?.address
  ) {
    delete product.contact;
  }

  return product;
}

export const handler: Handler = async (event) => {
  try {
    const q = (event.queryStringParameters?.q || "").toLowerCase();
    const category = (event.queryStringParameters?.category || "").toLowerCase();

    const sheets = sheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
      valueRenderOption: "FORMULA", // preserves IMAGE() to extract URL
    });

    const values = res.data.values || [];
    if (!values.length) {
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: '{"items":[]}' };
    }

    const headers = normalizeHeaders(values[0]);
    let items = values.slice(1).map((row, i) => mapRow(headers, row, i));

    if (category) {
      items = items.filter(p => (p.category || "").toLowerCase() === category);
    }
    if (q) {
      items = items.filter(p => {
        const hay = [p.name, p.code, p.category, p.description]
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
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e?.message || "Sheets read error" }),
    };
  }
};
