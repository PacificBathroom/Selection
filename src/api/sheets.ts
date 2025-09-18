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
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");

// Canonical header keys (normalized)
const HEADER_KEYS = {
  NAME: ["name", "product", "title"],
  IMAGE: ["imageurl", "image", "thumbnail", "imgurl", "picture", "photo"],
  DESC: ["description", "desc", "details"],
  PDF: ["pdfurl", "pdf", "specpdfurl", "specifications", "specsurl"],
  CODE: ["code", "product_code", "sku", "partnumber", "itemcode"],
} as const;

// pick value from a raw row by matching header variants
function pickByHeader(row: Record<string, any>, candidates: string[]) {
  for (const key of Object.keys(row)) {
    const nk = norm(key);
    if (candidates.some((c) => c === nk)) {
      return row[key];
    }
  }
  return undefined;
}

// Map a raw row object into our Product
function toProduct(row: Record<string, any>): Product {
  const name = pickByHeader(row, HEADER_KEYS.NAME);
  const image = pickByHeader(row, HEADER_KEYS.IMAGE);
  const description = pickByHeader(row, HEADER_KEYS.DESC);
  const pdf = pickByHeader(row, HEADER_KEYS.PDF);
  const code = pickByHeader(row, HEADER_KEYS.CODE);

  const p: Product = {
    name: name ? String(name) : undefined,
    product: name ? String(name) : undefined, // alias
    description: description ? String(description) : undefined,

    imageUrl: image ? String(image) : undefined,
    image: image ? String(image) : undefined,
    thumbnail: image ? String(image) : undefined,

    pdfUrl: pdf ? String(pdf) : undefined,
    specPdfUrl: pdf ? String(pdf) : undefined,

    code: code ? String(code) : undefined,
    sku: code ? String(code) : undefined,
  };

  // carry any extra properties through (just in case you added custom columns)
  for (const k of Object.keys(row)) {
    const v = row[k];
    if (v === "" || v == null) continue;
    const nk = norm(k);
    if (
      ![
        ...HEADER_KEYS.NAME,
        ...HEADER_KEYS.IMAGE,
        ...HEADER_KEYS.DESC,
        ...HEADER_KEYS.PDF,
        ...HEADER_KEYS.CODE,
      ].includes(nk)
    ) {
      p[k] = v;
    }
  }

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
  }) as any[][];

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

  const headers: string[] = (matrix[headerRowIdx] || []).map((h) =>
    String(h ?? "")
  );
  const dataRows = matrix.slice(headerRowIdx + 1);

  // Build objects safely (skip undefined header keys)
  const objects: Record<string, any>[] = dataRows.map((arr) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => {
      if ((h ?? "") !== "") {
        obj[h] = arr[i];
      }
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
