// src/api/sheets.ts
import type { Product } from "../types";

export type ProductRow = Product;

export interface ProductFilter {
  q?: string;
  category?: string;
  /** Accepts: "Products!A1:ZZ", "Products", or just "A:Z" */
  range?: string;
}

let __productsCache: Product[] | null = null;

/* ---------- helpers ---------- */
const norm = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "") // remove spaces
    .replace(/[()]/g, ""); // drop parens

// Candidate header keys (normalized)
const H = {
  NAME: ["name", "product", "title"],
  IMAGE: ["imageurl", "image", "thumbnail"],
  DESC: ["description", "desc"],
  PDF:  ["pdfurl", "pdf", "specpdfurl", "specifications"],
  CODE: ["code", "product_code", "sku"],
  CAT:  ["category", "cat"],
} as const;

function pickByHeader(
  row: Record<string, unknown>,
  cands: readonly string[]
): unknown {
  // Map: normalized original header -> original header
  const headerKeys = Object.keys(row);
  const byNorm = new Map<string, string>();
  for (const key of headerKeys) byNorm.set(norm(key), key);

  // Try each candidate; return first existing value
  for (const cand of cands) {
    const origKey = byNorm.get(norm(cand));
    if (origKey && origKey in row) return row[origKey];
  }
  return undefined;
}

function toProduct(row: Record<string, any>): Product {
  return {
    name: String(pickByHeader(row, H.NAME) ?? ""),
    description: String(pickByHeader(row, H.DESC) ?? ""),
    image: String(pickByHeader(row, H.IMAGE) ?? ""),
    imageUrl: String(pickByHeader(row, H.IMAGE) ?? ""),
    pdfUrl: String(pickByHeader(row, H.PDF) ?? ""),
    specPdfUrl: String(pickByHeader(row, H.PDF) ?? ""),
    code: String(pickByHeader(row, H.CODE) ?? ""),
    category: row["Category"] ?? ""
 
  // provide common aliases so existing components are happy
  const nameStr = name ? String(name) : undefined;
  const imageStr = image ? String(image) : undefined;
  const pdfStr = pdf ? String(pdf) : undefined;
  const codeStr = code ? String(code) : undefined;
  const catStr = category ? String(category) : undefined;

  const p: Product = {
    // canonical
    name: nameStr,
    description: description ? String(description) : undefined,
    image: imageStr,
    imageUrl: imageStr,
    pdfUrl: pdfStr,
    specPdfUrl: pdfStr,
    code: codeStr,
    category: catStr,

    // legacy/aliases used in some components
    product: nameStr,
    thumbnail: imageStr,
    sku: codeStr,
  };

  return p;
}

/* ---------- workbook loader with header detection ---------- */
async function loadAllProducts(range?: string): Promise<Product[]> {
  if (__productsCache && !range) return __productsCache;

  const XLSX = await import("xlsx");
  const res = await fetch("/assets/precero.xlsx", { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to fetch Excel: ${res.status}`);

  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  // Resolve sheet + optional A1 range
  let sheetName: string | undefined;
  let a1: string | undefined;

  if (range) {
    if (range.includes("!")) {
      const [sn, r] = range.split("!");
      sheetName = sn || undefined;
      a1 = r || undefined;
    } else if (/^[A-Z]+(?:\d+)?:[A-Z]+(?:\d+)?$/i.test(range)) {
      a1 = range;
    } else {
      sheetName = range;
    }
  }
  if (!sheetName) {
    sheetName =
      wb.SheetNames.find((n) => n.toLowerCase() === "products") ||
      wb.SheetNames[0];
  }

  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

  // Read as matrix to auto-find header row (one that contains "name")
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    defval: "",
    blankrows: false,
    ...(a1 ? { range: a1 } : {}),
  }) as unknown as any[][];

  if (!Array.isArray(matrix) || matrix.length === 0) return [];

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 50); i++) {
    const row = matrix[i] || [];
    if (row.some((cell) => norm(cell) === "name")) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) headerRowIdx = 0;

  const headers = (matrix[headerRowIdx] || []).map((h) => String(h ?? ""));
  const dataRows = matrix.slice(headerRowIdx + 1);

  const objects: Record<string, unknown>[] = dataRows.map((arr) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      // guard against out-of-bounds
      obj[h] = i < arr.length ? arr[i] : "";
    });
    return obj;
  });

  const products = objects
    .map(toProduct)
    .filter((p) => p.name || p.description || p.imageUrl || p.pdfUrl);

  if (!range) __productsCache = products;
  return products;
}

/* ---------- public API ---------- */
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
      const hay = [p.name, p.description, p.pdfUrl, p.imageUrl, p.code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  return items;
}
