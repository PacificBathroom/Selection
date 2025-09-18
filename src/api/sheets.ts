// src/api/sheets.ts
import type { Product } from "@/types";

/** Public shape the rest of the app uses */
export type ProductRow = Product;

export interface ProductFilter {
  q?: string;
  category?: string;
  /** Accepts: "Products!A1:ZZ", "Products", or just "A:Z" */
  range?: string;
}

/* ----------------- small utils ----------------- */
const norm = (s: unknown): string =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "") // remove spaces
    .replace(/[()]/g, ""); // drop parens

// Canonical header aliases (normalize before comparing)
const ALIAS = {
  NAME: ["name", "product", "title"],
  IMAGE: ["imageurl", "image", "thumbnail"],
  DESC: ["description", "desc"],
  PDF: ["pdfurl", "pdf", "specpdfurl", "specifications", "specsheet"],
  CODE: ["code", "product_code", "sku"],
  CATEGORY: ["category", "type"],
} as const;

let cache: ProductRow[] | null = null;

/* Pick value from a row using alias list */
function pickByAliases(
  row: Record<string, unknown>,
  aliases: readonly string[]
): unknown {
  // Build a normalized lookup once per row call
  const normalized: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    normalized[norm(k)] = row[k];
  }

  for (const a of aliases) {
    const key = norm(a);
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      return normalized[key];
    }
  }
  return undefined;
}

/** Convert a raw object row to our ProductRow */
function toProduct(row: Record<string, unknown>): ProductRow {
  const name = pickByAliases(row, ALIAS.NAME);
  const image = pickByAliases(row, ALIAS.IMAGE);
  const desc = pickByAliases(row, ALIAS.DESC);
  const pdf = pickByAliases(row, ALIAS.PDF);
  const code = pickByAliases(row, ALIAS.CODE);
  const category = pickByAliases(row, ALIAS.CATEGORY);

  const p: ProductRow = {
    name: name ? String(name) : undefined,
    description: desc ? String(desc) : undefined,
    image: image ? String(image) : undefined,
    imageUrl: image ? String(image) : undefined,
    pdfUrl: pdf ? String(pdf) : undefined,
    specPdfUrl: pdf ? String(pdf) : undefined,
    code: code ? String(code) : undefined,
    category: category ? String(category) : undefined,
  };

  return p;
}

/* ----------------- workbook loader ----------------- */
async function loadAllProducts(range?: string): Promise<ProductRow[]> {
  if (cache && !range) return cache;

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
    // Prefer a sheet actually named "Products"
    const preferred = wb.SheetNames.find((n) => n.toLowerCase() === "products");
    sheetName = preferred || wb.SheetNames[0];
  }

  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

  // Read matrix for header detection (find a row that contains "name")
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    blankrows: false,
    defval: "",
    ...(a1 ? { range: a1 } : {}),
  }) as any[][];

  if (!Array.isArray(matrix) || matrix.length === 0) return [];

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 50); i++) {
    const row = matrix[i] || [];
    if (row.some((cell: unknown) => norm(cell) === "name")) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) headerRowIdx = 0;

  const headers: string[] = (matrix[headerRowIdx] || []).map((h) =>
    String(h ?? "")
  );
  const dataRows: any[][] = matrix.slice(headerRowIdx + 1);

  // Build objects safely (guard against undefined header indices)
  const objects: Record<string, unknown>[] = dataRows.map((arr) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      // only assign if the index exists in the row
      if (i in arr) obj[h] = arr[i];
    });
    return obj;
  });

  const products = objects
    .map(toProduct)
    .filter(
      (p) => p.name || p.description || p.imageUrl || p.pdfUrl
    );

  if (!range) cache = products;
  return products;
}

/* ----------------- public API ----------------- */
export async function fetchProducts(
  params: ProductFilter = {}
): Promise<ProductRow[]> {
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
      const hay = [p.name, p.description, p.pdfUrl, p.imageUrl, p.code, p.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  return items;
}
