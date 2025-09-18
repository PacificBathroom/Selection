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

/* ----------------- helpers ----------------- */
const norm = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");

const HEADER_ALIASES: Record<
  "name" | "description" | "imageUrl" | "pdfUrl" | "code" | "category" | "price" | "specs",
  string[]
> = {
  name:        ["name", "product", "title"],
  description: ["description", "desc"],
  imageUrl:    ["imageurl", "image", "thumbnail", "img", "picture"],
  pdfUrl:      ["pdfurl", "pdf", "specpdfurl", "specifications", "spec_pdf_url", "specpdf"],
  code:        ["code", "sku", "product_code"],
  category:    ["category", "type"],
  price:       ["price", "cost", "rrp"],
  specs:       ["specs", "specs_bullets", "features"],
};

type RowObj = Record<string, any>;

function rowArrayToObj(headers: string[], row: any[]): RowObj {
  const obj: RowObj = {};
  for (let i = 0; i < headers.length; i++) {
    const rawKey = headers[i];
    const key: string = String(rawKey ?? "").trim();
    if (key) obj[key] = row[i] ?? "";
  }
  return obj;
}

function pickByAliases(raw: RowObj, aliases: string[]): any {
  // Build normalized lookup once
  const lookup: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = norm(k);
    if (key) lookup[key] = v;
  }
  for (const a of aliases) {
    const hit = lookup[norm(a)];
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function toProduct(raw: RowObj): Product {
  const p: Product = {
    name:        pickByAliases(raw, HEADER_ALIASES.name),
    description: pickByAliases(raw, HEADER_ALIASES.description),
    imageUrl:    pickByAliases(raw, HEADER_ALIASES.imageUrl),
    pdfUrl:      pickByAliases(raw, HEADER_ALIASES.pdfUrl),
    code:        pickByAliases(raw, HEADER_ALIASES.code),
    category:    pickByAliases(raw, HEADER_ALIASES.category),
    price:       pickByAliases(raw, HEADER_ALIASES.price),
  };

  // Normalize strings
  if (p.name != null)        p.name = String(p.name);
  if (p.description != null) p.description = String(p.description);
  if (p.imageUrl != null)    p.imageUrl = String(p.imageUrl);
  if (p.pdfUrl != null)      p.pdfUrl = String(p.pdfUrl);
  if (p.code != null)        p.code = String(p.code);
  if (p.category != null)    p.category = String(p.category);

  // Optional specs → array of bullets
  const rawSpecs = pickByAliases(raw, HEADER_ALIASES.specs);
  if (Array.isArray(rawSpecs)) {
    p.specs = rawSpecs.map((s) => String(s || "").trim()).filter(Boolean);
  } else if (typeof rawSpecs === "string" && rawSpecs.trim()) {
    p.specs = rawSpecs
      .split(/\r?\n|\u2022/g)
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  // Back-compat aliases for the rest of the app
  p.product = p.name;
  p.sku = p.code;
  p.image = p.imageUrl;
  p.thumbnail = p.imageUrl;
  p.specPdfUrl = p.pdfUrl;

  return p;
}

/* -------------- workbook loader with header detection -------------- */
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
      wb.SheetNames.find((n: string) => n.toLowerCase() === "products") ||
      wb.SheetNames[0];
  }

  const ws = wb.Sheets[String(sheetName)];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

  // Read as matrix so we can auto-find the header row (row containing "Name")
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    defval: "",
    blankrows: false,
    ...(a1 ? { range: a1 } : {}),
  }) as any[][];

  if (!Array.isArray(matrix) || matrix.length === 0) return [];

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 50); i++) {
    const row: any[] = matrix[i] || [];
    if (row.some((cell: unknown) => norm(cell) === "name")) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) headerRowIdx = 0;

  const headers: string[] = (matrix[headerRowIdx] || []).map((h: unknown) =>
    String(h ?? "")
  );
  const dataRows: any[][] = matrix.slice(headerRowIdx + 1);

  const rawObjects: RowObj[] = dataRows.map((arr: any[]) =>
    rowArrayToObj(headers, arr)
  );

  const products = rawObjects
    .map(toProduct)
    .filter((p) => p.name || p.description || p.imageUrl || p.pdfUrl || p.code);

  if (!range) __productsCache = products;
  return products;
}

/* ---------------- public API ---------------- */
export async function fetchProducts(
  params: ProductFilter = {}
): Promise<Product[]> {
  const { q, category, range } = params;
  let items = await loadAllProducts(range);

  if (category && category.trim()) {
    const needle = category.trim().toLowerCase();
    items = items.filter((p) => (p.category ?? "").toLowerCase() === needle);
  }

  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    items = items.filter((p) => {
      const hay = [p.name, p.code, p.description, p.category, p.pdfUrl, p.imageUrl]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  return items;
}
