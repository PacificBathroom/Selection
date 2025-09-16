// src/api/sheets.ts
import type { Product } from "../types";
import * as XLSX from "xlsx";

/**
 * Where the Excel file lives in your published site.
 * RECOMMENDED: rename to /assets/products.xlsx and use the first line.
 */
const EXCEL_PATH = "/assets/products.xlsx";
// const EXCEL_PATH = "/assets/Precero%20Updated.xlsx"; // use this if you keep the space

type Row = Record<string, unknown>;

const HEADER_ALIASES: Record<string, string[]> = {
  url: ["url", "Url", "URL"],
  name: ["name", "Name", "Product", "product"],
  imageurl: ["imageurl", "ImageURL", "Image Url", "Image", "thumbnail"],
  description: ["description", "Description"],
  pdfurl: ["pdfurl", "PdfURL", "PDF URL", "Specs", "Specs PDF"],
  // optional extras (ignored if missing)
  code: ["code", "Code", "SKU", "Sku"],
  category: ["category", "Category"],
};

function pick<T = string>(r: Row, keys: string[]): T | "" {
  for (const k of keys) {
    if (r[k] != null && String(r[k]).trim() !== "") return r[k] as T;
    const lower = Object.keys(r).find((kk) => kk.toLowerCase() === k.toLowerCase());
    if (lower && r[lower] != null && String(r[lower]).trim() !== "") {
      return r[lower] as T;
    }
  }
  return "" as unknown as T;
}

function normalizeRow(r: Row): Product {
  const p: Product = {
    url: String(pick(r, HEADER_ALIASES.url)),
    name: String(pick(r, HEADER_ALIASES.name)),
    imageurl: String(pick(r, HEADER_ALIASES.imageurl)),
    description: String(pick(r, HEADER_ALIASES.description)),
    pdfurl: String(pick(r, HEADER_ALIASES.pdfurl)),
  };

  const code = String(pick(r, HEADER_ALIASES.code));
  const category = String(pick(r, HEADER_ALIASES.category));
  if (code) (p as any).code = code;
  if (category) (p as any).category = category;

  return p;
}

async function fetchWorkbook(path: string): Promise<XLSX.WorkBook> {
  const res = await fetch(path, { credentials: "omit" });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  const buffer = await res.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
}

/**
 * Fetch products from the bundled Excel file and (optionally) filter by q/category.
 */
export async function fetchProducts(params?: {
  q?: string;
  category?: string;
}): Promise<Product[]> {
  const wb = await fetchWorkbook(EXCEL_PATH);

  // Use first worksheet by default
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];

  // Read rows as objects using the first row as headers
  const rawRows: Row[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  // Normalize/shape each row into our Product
  let items: Product[] = rawRows.map(normalizeRow).filter((p) => p.name || p.url);

  // Optional filtering
  const q = params?.q?.trim().toLowerCase() || "";
  const cat = params?.category?.trim().toLowerCase() || "";

  if (q) {
    items = items.filter((p) => {
      const hay = [
        p.name,
        p.description,
        (p as any).code,
        (p as any).category,
        p.url,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  if (cat) {
    items = items.filter(
      (p) => String((p as any).category || "").toLowerCase() === cat
    );
  }

  return items;
}
