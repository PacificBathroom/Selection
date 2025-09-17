// src/api/sheets.ts
import type { Product } from "../types";

export type ProductRow = Product;

export interface ProductFilter {
  q?: string;
  category?: string;
  range?: string; // e.g. "Products!A1:ZZ"
}

/** --- Helpers to map the Netlify function (Sheets) shape -> Product --- */
function fnItemToProduct(it: any): Product {
  // Your function returns keys like: product, thumbnail, pdf_url, description, specs[]
  return {
    name: it?.product || undefined,
    description: it?.description || undefined,
    image: it?.thumbnail || undefined,
    imageUrl: it?.thumbnail || undefined,
    pdfUrl: it?.pdf_url || undefined,
    specPdfUrl: it?.pdf_url || undefined,
    features: Array.isArray(it?.specs) ? it.specs : undefined,
    category: it?.category || undefined,
    sku: it?.sku || undefined,
  };
}

/** Try Google Sheets first if env is set and function exists */
async function fetchFromSheets(params: ProductFilter): Promise<Product[] | null> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.category) qs.set("category", params.category);
  if (params.range) qs.set("range", params.range);

  // Abort quickly if the function isn't configured
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(`/api/sheets${qs.size ? `?${qs}` : ""}`, {
      signal: controller.signal,
      headers: { "accept": "application/json" },
    });
    clearTimeout(t);
    if (!res.ok) return null; // function exists but not configured
    const data = await res.json();
    if (!data || !Array.isArray(data.items)) return null;
    return data.items.map(fnItemToProduct);
  } catch {
    clearTimeout(t);
    return null; // function missing / timed out / not configured
  }
}

/** Fallback: parse the committed Excel file */
async function fetchFromExcel(range?: string): Promise<Product[]> {
  const XLSX = await import("xlsx"); // dynamic import keeps bundling happy
  const res = await fetch("/assets/precero.xlsx", { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to fetch Excel: ${res.status}`);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  let sheetName: string | undefined;
  let a1: string | undefined;
  if (range) {
    if (range.includes("!")) {
      const [sn, r] = range.split("!");
      sheetName = sn || undefined; a1 = r || undefined;
    } else sheetName = range;
  }
  if (!sheetName) sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, a1 ? { range: a1 } : undefined);

  return rows.map((row) => {
    const name = row["Name"];
    const imageURL = row["ImageURL (direct image link)"];
    const description = row["Description"];
    const pdfURL = row["PdfURL (direct PDF link)"];
    const specs = row["SpecsBullets (optional text list)"];
    const features = specs
      ? String(specs).split(/\r?\n|;|,/).map(s => s.trim()).filter(Boolean)
      : undefined;
    return {
      name: name ? String(name) : undefined,
      description: description ? String(description) : undefined,
      image: imageURL ? String(imageURL) : undefined,
      imageUrl: imageURL ? String(imageURL) : undefined,
      pdfUrl: pdfURL ? String(pdfURL) : undefined,
      specPdfUrl: pdfURL ? String(pdfURL) : undefined,
      features,
    } as Product;
  });
}

/** Public API */
export async function fetchProducts(params: ProductFilter = {}): Promise<Product[]> {
  // 1) Try Sheets function (if configured)
  const fromSheets = await fetchFromSheets(params);
  if (fromSheets) return filterClientSide(fromSheets, params);

  // 2) Fallback to Excel in the repo
  const fromExcel = await fetchFromExcel(params.range);
  return filterClientSide(fromExcel, params);
}

function filterClientSide(items: Product[], { q, category }: ProductFilter): Product[] {
  let out = items;
  if (category && category.trim()) {
    const needle = category.trim().toLowerCase();
    out = out.filter(p => (p.category ?? "").toLowerCase() === needle);
  }
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    out = out.filter(p => {
      const hay = [
        p.name, p.description, p.pdfUrl, p.imageUrl, ...(p.features ?? []),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }
  return out;
}
