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
    .replace(/\s+/g, "")     // remove spaces
    .replace(/[()]/g, "");   // drop parens

// Canonical header keys (normalized, readonly tuples OK)
const H = {
  NAME:       ["name", "product", "title"] as const,
  IMAGE:      ["imageurl", "image", "thumbnail", "imgurl", "picture", "photo"] as const,
  DESC:       ["description", "desc", "details"] as const,
  PDF:        ["pdfurl", "pdf", "specpdfurl", "specifications", "specsurl"] as const,
  CODE:       ["code", "product_code", "sku", "partnumber", "itemcode"] as const,
  CATEGORY:   ["category", "group", "type"] as const,
  PRICE:      ["price", "cost", "rrp", "msrp"] as const,
  SPECS_TEXT: ["specs", "specifications", "techspecs"] as const,
} as const;

/**
 * Pick the first non-empty field from a row whose header matches any of the
 * provided names (case/space/paren-insensitive).
 */
function pickByHeader(
  row: Record<string, any>,
  candidates: readonly string[]
): any {
  // Build a normalized view of row keys once
  const byNormKey: Record<string, string> = {};
  for (const k of Object.keys(row)) {
    byNormKey[norm(k)] = k;
  }
  for (const c of candidates) {
    const key = byNormKey[norm(c)];
    if (key !== undefined) {
      const v = row[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        return v;
      }
    }
  }
  return undefined;
}

function toProduct(row: Record<string, any>): Product {
  const name = pickByHeader(row, H.NAME);
  const img  = pickByHeader(row, H.IMAGE);
  const desc = pickByHeader(row, H.DESC);
  const pdf  = pickByHeader(row, H.PDF);
  const code = pickByHeader(row, H.CODE);
  const cat  = pickByHeader(row, H.CATEGORY);
  const price= pickByHeader(row, H.PRICE);
  const specs= pickByHeader(row, H.SPECS_TEXT);

  const productName = name ? String(name) : undefined;

  return {
    // names / ids
    name: productName,
    product: productName,
    sku: code ? String(code) : undefined,
    code: code ? String(code) : undefined,

    // categorization
    category: cat ? String(cat) : undefined,

    // display
    description: desc ? String(desc) : undefined,

    // media
    image: img ? String(img) : undefined,
    imageUrl: img ? String(img) : undefined,
    thumbnail: img ? String(img) : undefined,
    pdfUrl: pdf ? String(pdf) : undefined,
    specPdfUrl: pdf ? String(pdf) : undefined,

    // price
    price: typeof price === "number" ? price : price != null ? String(price) : undefined,

    // specs
    // if specs looks like JSON array of {label,value}, try to parse safely
    ...(typeof specs === "string"
      ? (() => {
          const s = specs.trim();
          if (s.startsWith("[") && s.endsWith("]")) {
            try {
              const parsed = JSON.parse(s);
              if (Array.isArray(parsed)) {
                return { specs: parsed };
              }
            } catch {}
          }
          return { specifications: s, specs: s };
        })()
      : specs != null
      ? { specs }
      : {}),
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

  // Read as matrix to auto-find header row (one that contains a NAME-like column)
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    defval: "",
    blankrows: false,
    ...(a1 ? { range: a1 } : {}),
  }) as any[][];

  if (!Array.isArray(matrix) || matrix.length === 0) return [];

  // detect header row by presence of a name-ish column
  let headerRowIdx = -1;
  const nameKeys = new Set(H.NAME.map((s) => norm(s)));
  for (let i = 0; i < Math.min(matrix.length, 50); i++) {
    const row = matrix[i] || [];
    const hasNameLike = row.some((cell) => nameKeys.has(norm(cell)));
    if (hasNameLike) {
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
    .filter(
      (p) =>
        p.product ||
        p.name ||
        p.description ||
        p.imageUrl ||
        p.pdfUrl
    );

  if (!range) __productsCache = products;
  return products;
}

/* ---------- public API ---------- */
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
        p.sku,
        p.code,
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
