import type { Product } from "../types";

export type ProductRow = Product;

export interface ProductFilter {
  q?: string;
  category?: string;
  range?: string; // optional sheet/range, e.g. "Products!A1:ZZ"
}

let __productsCache: Product[] | null = null;

function rowToProduct(row: Record<string, any>): Product {
  const name = row["Name"];
  const imageURL = row["ImageURL (direct image link)"];
  const description = row["Description"];
  const pdfURL = row["PdfURL (direct PDF link)"];
  const specs = row["SpecsBullets (optional text list)"];

  const features = specs
    ? String(specs)
        .split(/\r?\n|;|,/)
        .map(s => s.trim())
        .filter(Boolean)
    : undefined;

  return {
    name: name ? String(name) : undefined,
    description: description ? String(description) : undefined,
    image: imageURL ? String(imageURL) : undefined,
    imageUrl: imageURL ? String(imageURL) : undefined,
    pdfUrl: pdfURL ? String(pdfURL) : undefined,
    specPdfUrl: pdfURL ? String(pdfURL) : undefined,
    features
  };
}

async function loadAllProducts(range?: string): Promise<Product[]> {
  if (__productsCache && !range) return __productsCache;

  const XLSX = await import("xlsx");
  const res = await fetch("/assets/precero.xlsx", { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to fetch Excel: ${res.status}`);

  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  let sheetName: string;
  let a1: string | undefined;

  if (range) {
    if (range.includes("!")) {
      const [sn, r] = range.split("!");
      sheetName = sn || wb.SheetNames[0];
      a1 = r || undefined;
    } else {
      sheetName = range;
    }
  } else {
    sheetName = wb.SheetNames[0];
  }

  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

  const rows = XLSX.utils.sheet_to_json(ws, a1 ? { range: a1 } : undefined) as Record<string, any>[];
  const products = rows.map(rowToProduct);

  if (!range) __productsCache = products;
  return products;
}

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
        ...(p.features ?? [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  return items;
}
