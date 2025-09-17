// src/api/sheets.ts
import * as XLSX from "xlsx";

export type ProductRow = {
  product?: string;        // alias for name for UI
  name?: string;
  description?: string;
  thumbnail?: string;      // image alias used by cards
  imageUrl?: string;       // same image
  pdfUrl?: string;         // specs image OR a pdf link
  sku?: string;            // from "Code"
  code?: string;
  category?: string;
  price?: string | number;
};

export interface ProductFilter {
  q?: string;
  category?: string;
  /** Accepts: "Products!A1:ZZ", "Products", or just "A:Z" */
  range?: string;
}

let __productsCache: ProductRow[] | null = null;

/* ---------------- helpers ---------------- */

const norm = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");

// convert weird worksheet cell objects to plain text safely
const toText = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  // common shapes from XLSX: { v: 'Text', t: 's' } or { text: 'Text', l:{Target:'...'} }
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("v" in v && typeof v.v === "string") return v.v;
    try {
      return String(v);
    } catch {
      return "";
    }
  }
  return String(v);
};

// header groups we’ll search for in a case/space insensitive way
const H = {
  NAME: ["name", "product", "title"],
  IMAGE: ["imageurl", "image", "thumbnail", "img"],
  DESC: ["description", "desc"],
  PDF: ["pdfurl", "pdf", "specpdfurl", "specifications"],
  CODE: ["code", "product_code", "sku"],
  CATEGORY: ["category", "type"],
  PRICE: ["price", "cost", "rrp"],
};

const pick = (obj: Record<string, any>, keys: string[]) => {
  // keys are already normalized; normalize incoming header names too
  for (const k in obj) {
    const nk = norm(k);
    if (keys.includes(nk)) return obj[k];
  }
  return undefined;
};

/* --------------- workbook loader --------------- */

async function loadAll(range?: string): Promise<ProductRow[]> {
  if (__productsCache && !range) return __productsCache;

  const res = await fetch("/assets/precero.xlsx", { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to fetch Excel: ${res.status}`);

  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  // sheet + optional A1 range
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

  // read as rows so we can detect the header row that contains "name"
  const matrix = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    defval: "",
    blankrows: false,
    ...(a1 ? { range: a1 } : {}),
  }) as any[][];

  if (!Array.isArray(matrix) || matrix.length === 0) return [];

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 50); i++) {
    const row = matrix[i] || [];
    if (row.some((cell) => norm(cell) === "name")) {
      headerRowIdx = i;
      break;
    }
  }

  const rawHeaders: string[] = (matrix[headerRowIdx] || []).map((h) =>
    String(h ?? "")
  );
  const normalizedHeaders = rawHeaders.map((h) => norm(h));
  const dataRows = matrix.slice(headerRowIdx + 1);

  const objects: Record<string, any>[] = dataRows.map((arr) => {
    const obj: Record<string, any> = {};
    rawHeaders.forEach((h, i) => (obj[h] = arr[i]));
    return obj;
  });

  const items = objects.map((row) => {
    // pick by normalized header name
    const name = toText(pick(row, H.NAME));
    const img = toText(pick(row, H.IMAGE));
    const desc = toText(pick(row, H.DESC));
    const pdf = toText(pick(row, H.PDF));
    const code = toText(pick(row, H.CODE));
    const category = toText(pick(row, H.CATEGORY));
    const priceRaw = pick(row, H.PRICE);
    const price =
      typeof priceRaw === "number" || typeof priceRaw === "string"
        ? (priceRaw as any)
        : undefined;

    const pr: ProductRow = {
      // keep both 'name' and UI’s expected 'product'
      product: name || undefined,
      name: name || undefined,
      description: desc || undefined,
      thumbnail: img || undefined,
      imageUrl: img || undefined,
      pdfUrl: pdf || undefined,
      sku: code || undefined,
      code: code || undefined,
      category: category || undefined,
      price,
    };
    return pr;
  });

  const filtered = items.filter(
    (p) => p.product || p.description || p.imageUrl || p.pdfUrl
  );

  if (!range) __productsCache = filtered;
  return filtered;
}

/* --------------- public API --------------- */

export async function fetchProducts(params: ProductFilter = {}): Promise<ProductRow[]> {
  const { q, category, range } = params;
  let items = await loadAll(range);

  if (category && category.trim()) {
    const needle = category.trim().toLowerCase();
    items = items.filter((p) => (p.category ?? "").toLowerCase() === needle);
  }

  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    items = items.filter((p) => {
      const hay = [p.product, p.description, p.pdfUrl, p.imageUrl, p.sku, p.code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  return items;
}
