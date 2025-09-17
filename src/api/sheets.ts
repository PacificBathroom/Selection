// src/api/sheets.ts
import type { Product } from "../types";

export type ProductRow = Product;

export interface ProductFilter {
  q?: string;
  category?: string;   // future-proofing
  range?: string;      // e.g. "Products!A:Z" or just "Products"
}

/** Cache parsed products per session */
let __productsCache: Product[] | null = null;

/** Convert one XLSX row (by your exact headers) into a Product */
function rowToProductExact(row: Record<string, any>): Product {
  const name = row["Name"];
  const imageURL = row["ImageURL (direct image link)"];
  const description = row["Description"];
  const pdfURL = row["PdfURL (direct PDF link)"];
  const specs = row["SpecsBullets (optional text list)"];

  const features = (() => {
    if (specs == null) return undefined;
    const s = String(specs).trim();
    if (!s) return undefined;
    const parts = s.split(/\r?\n|;|,/).map(t => t.trim()).filter(Boolean);
    return parts.length ? parts : undefined;
  })();

  return {
    name: name ? String(name) : undefined,
    description: description ? String(description) : undefined,
    image: imageURL ? String(imageURL) : undefined,
    imageUrl: imageURL ? String(imageURL) : undefined,   // alias
    pdfUrl: pdfURL ? String(pdfURL) : undefined,
    specPdfUrl: pdfURL ? String(pdfURL) : undefined,     // alias
    features,
  };
}

/** Load all products from the workbook (optionally a specific sheet/range) */
async function loadAllProducts(range?: string): Promise<Product[]> {
  if (__productsCache && !range) return __productsCache;

  // ✅ dynamic import so bundling is friendlier
  const XLSX = await import("xlsx");

  const res = await fetch("/assets/precero.xlsx", { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to fetch Excel: ${res.status}`);

  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  let sheetName: string | undefined;
  let a1: string | undefined;

  if (range) {
    if (range.includes("!")) {
      const [sn, r] = range.split("!");
      sheetName = sn || undefined;
      a1 = r || undefined;
    } else {
      sheetName = range;
    }
  }
  if (!sheetName) sheetName = wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, a1 ? { range: a1 } : undefined);
  const products = rows.map(rowToProductExact);

  if (!range) __productsCache = products;
  return products;
}

/** Public API for components */
export async function fetchProducts(params: ProductFilter = {}): Promise<Product[]> {
  const { q, category, range } = params;
  let items = await loadAllProducts(range);

  if (category && category.trim()) {
    const needle = category.trim().toLowerCase();
    items = items.filter(p => (p.category ?? "").toLowerCase() === needle);
  }

  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    items = items.filter(p => {
      const hay = [
        p.name,
        p.description,
        p.pdfUrl,
        p.imageUrl,
        ...(p.features ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  return items;
}
