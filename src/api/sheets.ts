// src/api/sheets.ts
import type { Product } from "../types";
export type ProductRow = Product;

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
// "WELS 4 Star: 6L/min | Brass Body | Finish - Chrome"
function parseSpecsBullets(
  v: unknown
): { label?: string; value?: string }[] | undefined {
  if (typeof v !== "string") return undefined;
  const pieces = v
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!pieces.length) return undefined;
  const out = pieces.map((item) => {
    if (item.includes(":")) {
      const [label, ...rest] = item.split(":");
      return {
        label: label.trim() || undefined,
        value: rest.join(":").trim() || undefined,
      };
    }
    const dash = item.indexOf(" - ");
    if (dash > 0) {
      return {
        label: item.slice(0, dash).trim() || undefined,
        value: item.slice(dash + 3).trim() || undefined,
      };
    }
    return { value: item };
  });
  return out;
}

function toProductFromExactHeaders(
  row: Record<string, unknown>,
  idx: number
): Product {
  const selected = boolish(val(row, "Select"));
  const url = val(row, "URL");                // <-- exact: URL
  const code = val(row, "Code");
  const name = val(row, "Name");
  const imageURL = val(row, "ImageURL");
  const description = val(row, "Description");
  const specsBullets = val(row, "SpecsBullets");
  const pdfURL = val(row, "PDFUrl");          // <-- exact: PDFUrl
  const contactName = val(row, "ContactName");
  const contactEmail = val(row, "ContactEmail");
  const contactPhone = val(row, "ContactPhone");
  const contactAddr = val(row, "ContactAddress");
  const category = val(row, "Category");

  // Normalize specs from "SpecsBullets"
  const specsParsed = parseSpecsBullets(specsBullets);
  const specifications =
    typeof specsBullets === "string" ? specsBullets : undefined;

  const productName = name ? String(name) : undefined;
  const id = String(code ?? url ?? productName ?? `row-${idx + 2}`).trim();

  const product: Product = {
    id,

    // core
    name: productName,
    product: productName as any, // legacy alias
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
    ...(specsParsed ? { specs: specsParsed as any } : {}),
    ...(specifications ? { specifications } : {}),

    // pdf/spec sheets
    pdfUrl: pdfURL ? String(pdfURL) : undefined,
    specPdfUrl: pdfURL ? String(pdfURL) : undefined,

    // category
    category: category ? String(category) : undefined,

    // contacts (both nested + flat for legacy UI)
    contact: {
      name: contactName ? String(contactName) : undefined,
      email: contactEmail ? String(contactEmail) : undefined,
      phone: contactPhone ? String(contactPhone) : undefined,
      address: contactAddr ? String(contactAddr) : undefined,
    },
    contactName: contactName ? String(contactName) : undefined,
    contactEmail: contactEmail ? String(contactEmail) : undefined,
    contactPhone: contactPhone ? String(contactPhone) : undefined,
    contactAddress: contactAddr ? String(contactAddr) : undefined,

    // selection
    selected: selected,
  };

  // drop empty nested contact to keep JSON tidy
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

/* ---------- Google Sheets-backed loader ---------- */
let __productsCache: Product[] | null = null;

async function loadAllProducts(range?: string): Promise<Product[]> {
  if (__productsCache && !range) return __productsCache;
  const qs = range ? `?range=${encodeURIComponent(range)}` : "";
  // uses your redirect: /api/* -> /.netlify/functions/:splat
  const res = await fetch(`/api/sheets${qs}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Sheets API error ${res.status}`);
  const rows = (await res.json()) as Record<string, unknown>[];

  const products = rows
    .map((row, i) => toProductFromExactHeaders(row, i))
    .filter((p) => p.name || p.description || p.imageUrl || p.pdfUrl);

  if (!range) __productsCache = products;
  return products;
}

/* ---------- public API ---------- */
export interface ProductFilter {
  q?: string;
  category?: string;
  /** Accepts: "Products!A1:ZZ", "Products", or just "A:Z" */
  range?: string;
}

export async function fetchProducts(
  params: ProductFilter = {}
): Promise<Product[]> {
  const { q, category, range } = params;
  let items = await loadAllProducts(range);

  if (category && category.trim()) {
    const needle = category.trim().toLowerCase();
    items = items.filter(
      (p) => (p.category ?? "").toLowerCase() === needle
    );
  }

  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    items = items.filter((p) => {
      const hay = [
        (p as any).product,
        p.name,
        p.code,
        (p as any).sku,
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