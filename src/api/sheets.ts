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

function pickByHeader(row: Record<string, any>, candidates: string[]): any {
  for (const key of Object.keys(row)) {
    if (candidates.includes(norm(key))) {
      return row[key];
    }
  }
  return undefined;
}

// Canonical header keys (normalized)
const H = {
  NAME: ["name", "product", "title"].map(norm),
  IMAGE: ["imageurl", "image", "thumbnail"].map(norm),
  DESC: ["description", "desc"].map(norm),
  PDF: ["pdfurl", "pdf", "specpdfurl", "specifications"].map(norm),
  CODE: ["code", "product_code", "sku"].map(norm),
  SPECS: ["specsbullets", "specs", "features"].map(norm), // optional future column
};

function toProduct(row: Record<string, any>): Product {
  const name = pickByHeader(row, H.NAME);
  const image = pickByHeader(row, H.IMAGE);
  const description = pickByHeader(row, H.DESC);
  const pdf = pickByHeader(row, H.PDF);
  const code = pickByHeader(row, H.CODE);
  const specs = pickByHeader(row, H.SPECS);

  let features: string[] | undefined;
  if (specs) {
    const s = String(specs).trim();
    if (s) {
      features = s
        .split(/\r?\n|;|,/)
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  return {
    name: name ? String(name) : undefined,
    description: description ? String(description) : undefined,
    image: image ? String(image) : undefined,
    imageUrl: image ? String(image) : undefined,
    pdfUrl: pdf ? String(pdf) : undefined,
    specPdfUrl: pdf ? String(pdf) : undefined,
    code: code ? String(code) : undefined,
    features,
  };
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

  const headers = (matrix[headerRowIdx] || []).map((h) => String(h ?? ""));
  const dataRows = matrix.slice(headerRowIdx + 1);

  const objects: Record<string, any>[] = dataRows.map((arr) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => (obj[h] = arr[i]));
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
