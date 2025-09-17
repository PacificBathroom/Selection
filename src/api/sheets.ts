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

function pickByHeader(row: Record<string, any>, candidates: string[]): any {
  // Build a normalized -> actual key map once for the row
  const normalized: Record<string, string> = {};
  for (const k of Object.keys(row)) {
    const nk = norm(k);
    normalized[nk] = k; // nk is always a string
  }
  for (const want of candidates) {
    const physicalKey = normalized[want]; // string | undefined
    if (typeof physicalKey === "string") return row[physicalKey];
  }
  return undefined;
}

// Your sheet columns: Name, ImageURL, Description, PdfURL, (optional) Code, SpecsBullets
const H = {
  NAME: ["name", "product", "title"].map(norm),
  IMAGE: ["imageurl", "image", "thumbnail"].map(norm),
  DESC: ["description", "desc"].map(norm),
  PDF: ["pdfurl", "pdf", "specpdfurl", "specifications"].map(norm),
  CODE: ["code", "product_code", "sku"].map(norm),
  SPECS: ["specsbullets", "specs", "features"].map(norm),
};

function toProduct(row: Record<string, any>): Product {
  const name = pickByHeader(row, H.NAME);
  const image = pickByHeader(row, H.IMAGE);
  const description = pickByHeader(row, H.DESC);
  const pdf = pickByHeader(row, H.PDF);
  const code = pickByHeader(row, H.CODE);
  const specs = pickByHeader(row, H.SPECS);

  let features: string[] | undefined;
  if (specs != null) {
    const s = String(specs).trim();
    if (s) {
      features = s
        .split(/\r?\n|;|,/)
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  const product: Product = {
    name: name ? String(name) : undefined,
    description: description ? String(description) : undefined,

    // Image box (and UI cards) use this URL
    image: image ? String(image) : undefined,
    imageUrl: image ? String(image) : undefined,

    // Specs link (used as a hyperlink in the PPT)
    pdfUrl: pdf ? String(pdf) : undefined,
    specPdfUrl: pdf ? String(pdf) : undefined,

    // Optional product code
    code: code ? String(code) : undefined,

    features,
  };

  // Back-compat: some UI code reads p.product.<field>
  (product as any).product = product;

  return product;
}

/* ---------- loader ---------- */
async function loadAllProducts(range?: string): Promise<Product[]> {
  // Only cache when no custom range is used
  if (__productsCache && !range) return __productsCache;

  const XLSX: any = await import("xlsx");
  const res = await fetch("/assets/precero.xlsx", { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to fetch Excel: ${res.status}`);

  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

// Resolve sheet + optional A1 range
let sheetName!: string;             // <-- guaranteed string (we'll assign before use)
let a1: string | undefined;

if (range) {
  if (range.includes("!")) {
    const [sn, r] = range.split("!");
    if (sn && sn.trim()) sheetName = sn.trim();
    if (r && r.trim()) a1 = r.trim();
  } else if (/^[A-Z]+(?:\d+)?:[A-Z]+(?:\d+)?$/i.test(range)) {
    a1 = range;
  } else {
    sheetName = range.trim();
  }
}
if (!sheetName) {
  const names = (wb.SheetNames || []) as string[];
  sheetName = names.find((n) => n.toLowerCase() === "products") || names[0] || "";
}
if (!sheetName) throw new Error("Workbook has no sheets");

const ws = wb.Sheets[sheetName];    // sheetName is definitely a string now
if (!ws) throw new Error(`Sheet "${sheetName}" not found`);


  // Read as matrix (header:1) so we can detect header row containing "Name"
  const matrix = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    blankrows: false,
    ...(a1 ? { range: a1 } : {}),
  }) as unknown as any[][];

  if (!Array.isArray(matrix) || matrix.length === 0) {
    if (!range) __productsCache = [];
    return [];
  }

  // Find header row (first row where any cell normalizes to 'name'), else assume first row
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 50); i++) {
    const row = Array.isArray(matrix[i]) ? matrix[i] : [];
    if (row.some((cell: any) => norm(cell) === "name")) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) headerRowIdx = 0;

  // Force headers to string[]
  const rawHeaders: string[] = (Array.isArray(matrix[headerRowIdx]) ? matrix[headerRowIdx] : [])
    .map((h: any) => String(h ?? "").trim());

  // Data rows after header
  const dataRows: any[][] = matrix.slice(headerRowIdx + 1).map((r) => (Array.isArray(r) ? r : []));

  // Build objects with GUARANTEED string keys
  const objects: Record<string, any>[] = dataRows.map((arr: any[]) => {
    const obj: Record<string, any> = {};
    for (let i = 0; i < rawHeaders.length; i++) {
      const headerCandidate = rawHeaders[i];
      const safeKey: string = headerCandidate && headerCandidate.length ? headerCandidate : `col_${i}`;
      // Always assign using a string key
      obj[safeKey] = i < arr.length ? arr[i] : "";
    }
    return obj;
  });

  const products = objects
    .map(toProduct)
    .filter((p) => p.name || p.description || p.imageUrl || p.pdfUrl);

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
        p.name,
        p.description,
        p.pdfUrl,
        p.imageUrl,
        p.code,
        ...(Array.isArray(p.features) ? p.features : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  return items;
}
