// src/api/sheets.ts
import type { Product } from "../types";


  const qs = new URLSearchParams(params as any).toString();
  const url = "/.netlify/functions/products" + (qs ? `?${qs}` : "");

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Products fetch failed (${resp.status})`);
  const data = (await resp.json()) as { items: Product[] };
  return data.items ?? [];
}

export type ProductRow = Product;

export interface ProductFilter {
  q?: string;
  category?: string;
  /** Accepts: "Products!A1:ZZ", "Products", or just "A:Z" */
  range?: string;
}

let __productsCache: Product[] | null = null;

/* ---------- header-aware helpers for your exact columns ---------- */
function val(row: Record<string, unknown>, key: string): unknown | undefined {
  const v = (row as any)[key];
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : v;
}

function boolish(v: unknown): boolean | undefined {
  if (v === true) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(s)) return true;
    if (["false", "no", "n", "0"].includes(s)) return false;
  }
  if (typeof v === "number") return v !== 0;
  return undefined;
}

// Parse "SpecsBullets" like:
//   "WELS 4 Star: 6L/min | Brass Body | Finish - Chrome"
// → [{label: "WELS 4 Star", value:"6L/min"}, {value:"Brass Body"}, {label:"Finish", value:"Chrome"}]
function parseSpecsBullets(v: unknown): { label?: string; value?: string }[] | undefined {
  if (typeof v !== "string") return undefined;
  const pieces = v.split("|").map((s) => s.trim()).filter(Boolean);
  if (!pieces.length) return undefined;
  const out = pieces.map((item) => {
    const hasColon = item.includes(":");
    if (hasColon) {
      const [label, ...rest] = item.split(":");
      return { label: label.trim() || undefined, value: rest.join(":").trim() || undefined };
    }
    // allow "Label - Value" too
    const dash = item.indexOf(" - ");
    if (dash > 0) {
      return { label: item.slice(0, dash).trim() || undefined, value: item.slice(dash + 3).trim() || undefined };
    }
    return { value: item };
  });
  return out;
}

function toProductFromExactHeaders(row: Record<string, unknown>): Product {
  const selected      = boolish(val(row, "Select"));
  const url           = val(row, "Url");
  const code          = val(row, "Code");
  const name          = val(row, "Name");
  const imageURL      = val(row, "ImageURL");
  const description   = val(row, "Description");
  const specsBullets  = val(row, "SpecsBullets");
  const pdfURL        = val(row, "PdfURL");
  const contactName   = val(row, "ContactName");
  const contactEmail  = val(row, "ContactEmail");
  const contactPhone  = val(row, "ContactPhone");
  const contactAddr   = val(row, "ContactAddress");
  const category      = val(row, "Category");

  // Normalize specs based on your "SpecsBullets" column
  const specsParsed = parseSpecsBullets(specsBullets);
  const specifications = typeof specsBullets === "string" ? specsBullets : undefined;

  const productName = name ? String(name) : undefined;

  return {
    // names / ids
    name: productName,
    product: productName,
    code: code ? String(code) : undefined,
    sku: code ? String(code) : undefined,
    url: url ? String(url) : undefined,

    // media
    imageUrl: imageURL ? String(imageURL) : undefined,
    image: imageURL ? String(imageURL) : undefined,
    thumbnail: imageURL ? String(imageURL) : undefined,

    // copy
    description: description ? String(description) : undefined,

    // specs
    ...(specsParsed ? { specs: specsParsed } : {}),
    ...(specifications ? { specifications } : {}),

    // pdf/spec sheets
    pdfUrl: pdfURL ? String(pdfURL) : undefined,
    specPdfUrl: pdfURL ? String(pdfURL) : undefined,

    // category
    category: category ? String(category) : undefined,

    // contacts
    contactName: contactName ? String(contactName) : undefined,
    contactEmail: contactEmail ? String(contactEmail) : undefined,
    contactPhone: contactPhone ? String(contactPhone) : undefined,
    contactAddress: contactAddr ? String(contactAddr) : undefined,

    // selection
    selected: selected,
  };
}

/* ---------- Google Sheets-backed loader ---------- */
async function loadAllProducts(range?: string): Promise<Product[]> {
  if (__productsCache && !range) return __productsCache;
  const qs = range ? `?range=${encodeURIComponent(range)}` : "";
  const res = await fetch(`/api/sheets${qs}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Sheets API error ${res.status}`);
  const rows = (await res.json()) as Record<string, unknown>[];

  const products = rows
    .map(toProductFromExactHeaders)
    .filter((p) => p.product || p.name || p.description || p.imageUrl || p.pdfUrl);

  if (!range) __productsCache = products;
  return products;
}

/* ---------- public API ---------- */
export interface ProductFilter {
  q?: string;
  category?: string;
  range?: string;
}

export async function fetchProducts(params: ProductFilter = {}): Promise<Product[]> {
  const { q, category, range } = params;
  let items = await loadAllProducts(range);

  if (category && category.trim()) {
    const needle = category.trim().toLowerCase();
    items = items.filter((p) => (p.category ?? "").toLowerCase() === needle);
  }

  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    items = items.filter((p) => {
      const hay = [
        p.product,
        p.name,
        p.code,
        p.sku,
        p.url,
        p.category,
        p.description,
        p.pdfUrl,
        p.imageUrl,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  return items;
}
