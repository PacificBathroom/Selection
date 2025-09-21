import type { Handler } from "@netlify/functions";
import { google } from "googleapis";
import type { Product } from "../../src/types"; // adjust path if needed

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!;
const RANGE = "Products!A:ZZ"; // change tab if needed

// -- helpers ----------------------------------------------------
function extractImage(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^=*\s*IMAGE\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return (m?.[1] ?? v.trim()) || undefined;
}
const asText = (v: unknown) => (v == null ? undefined : String(v).trim() || undefined);
function splitSpecs(v: unknown): string[] | undefined {
  if (Array.isArray(v)) {
    const arr = v.map(x => String(x ?? "").trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  }
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  return s.split(/\r?\n|•|–|—|-\s/g).map(p => p.trim()).filter(Boolean) || undefined;
}
function toNumber(v: unknown): number | null {
  const s = String(v ?? "").replace(/[, ]+/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function normalizeHeaders(raw: unknown[]): string[] {
  return (raw || []).map(h => String(h ?? "").trim().toLowerCase());
}
function makeId(seed: Partial<Product>, idx: number) {
  return (seed.code || seed.url || seed.name || `row-${idx + 2}`).toString();
}

function authSheets() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

// Your exact headers (case-insensitive)
const H = {
  select: "select",
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
  price: "price", // optional column if you add it
} as const;

// -- row mapper -------------------------------------------------
function mapRow(headers: string[], row: unknown[], idx: number): Product {
  const cell = (key: string) => row[headers.indexOf(key)];

  const code = asText(cell(H.code));
  const url = asText(cell(H.url));
  const name = asText(cell(H.name));

  const contactName = asText(cell(H.contactname));
  const contactEmail = asText(cell(H.contactemail));
  const contactPhone = asText(cell(H.contactphone));
  const contactAddress = asText(cell(H.contactaddress));

  const product: Product = {
    id: makeId({ code, url, name }, idx),

    // core
    url,
    code,
    name,
    category: asText(cell(H.category)),

    // media
    imageUrl: extractImage(cell(H.imageurl)),

    // copy
    description: asText(cell(H.description)),

    // specs & docs
    specs: splitSpecs(cell(H.specsbullets)),
    pdfUrl: asText(cell(H.pdfurl)),

    // optional price
    price: toNumber(cell(H.price)),

    // nested contact
    contact: {
      name: contactName,
      email: contactEmail,
      phone: contactPhone,
      address: contactAddress,
    },

    // flat contact (legacy compatibility)
    contactName,
    contactEmail,
    contactPhone,
    contactAddress,
  };

  // Remove empty nested contact if all fields are blank
  if (!product.contact?.name && !product.contact?.email && !product.contact?.phone && !product.contact?.address) {
    delete product.contact;
  }

  return product;
}

// -- handler ----------------------------------------------------
export const handler: Handler = async (event) => {
  try {
    const q = (event.queryStringParameters?.q || "").toLowerCase();
    const category = (event.queryStringParameters?.category || "").toLowerCase();

    const sheets = authSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
      valueRenderOption: "FORMULA", // keep IMAGE() for URL extraction
    });

    const values = res.data.values || [];
    if (!values.length) {
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: '{"items":[]}' };
    }

    const headers = normalizeHeaders(values[0]);
    let items = values.slice(1).map((row, i) => mapRow(headers, row, i));

    // filters
    if (category) items = items.filter(p => (p.category || "").toLowerCase() === category);
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
