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
  const normalized = Object.fromEntries(
    Object.keys(row).map((k) => [norm(k), k])
  );
  for (const want of candidates) {
    const physicalKey = normalized[want];
    if (physicalKey != null) return (row as any)[physicalKey];
  }
  return undefined;
}

// Canonical header keys (normalized)
// Your sheet uses: Name, ImageURL, Description, PdfURL, (optional) Code, SpecsBullets
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

    // Optional code/sku if present
    code: code ? String(code) : undefined,

    features,
  };

  // legacy alias for any code that reads p.product?.field
  (product as any).product = product;

  return product;
}

/* ---------- public loader (reads workbook and applies filters) ---------- */
export async function fetchProducts(params: ProductFilter = {}): Promise<Product[]> {
  const { q, category, range } = params;

  if (!__productsCache || range) {
    const XLSX: any = await import("xlsx");
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
        wb.SheetNames.find((n: string) => n.toLowerCase() === "products") || wb.SheetNames[0];
    }

    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

    // Read as matrix to auto-find header row (row that contains "Name")
    const matrix = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      blankrows: false,
      ...(a1 ? { range: a1 } : {}),
    }) as unknown as any[][];

    if (!Array.isArray(matrix) || matrix.length === 0) return [];

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(matrix.length, 50); i++) {
      const row = matrix[i] || [];
      if (row.some((cell: any) => norm(cell) === "name")) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx === -1) headerRowIdx = 0;

    const rawHeaders = (matrix[headerRowIdx] || []).map((h: any) => String(h ?? "").trim());
    const dataRows = matrix.slice(headerRowIdx + 1);

    // Build row objects with a guaranteed string key (fixes TS2538)
    const objects: Record<string, any>[] = dataRows.map((arr: any[]) => {
      const obj: Record<string, any> = {};
      rawHeaders.forEach((h, i) => {
        const safeKey = String(h && String(h).trim() ? h : `col_${i}`);
        obj[safeKey] = arr[i];
      });
      return obj;
    });

    const products = objects
      .map(toProduct)
      .filter((p) => p.name || p.description || p.imageUrl || p.pdfUrl);

    if (!range) __productsCache = products;
    else __productsCache = null;

    let items = products;

    // Optional category filter (no-op unless you add a Category column later)
    if (category && category.trim()) {
      const needle = category.trim().toLowerCase();
      items = items.filter((p) => (p.category ?? "").toLowerCase() === needle);
    }

    // Text search across common fields
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

  // Use cache
  let items = __productsCache!;

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
