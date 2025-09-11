// src/api/sheets.ts
import type { Product } from "../types";

// Keep this alias so older components that import ProductRow still work
export type ProductRow = Product;

/**
 * Fetch products from the Netlify Sheets function.
 * Optional params:
 *  - q: search query
 *  - category: exact category match
 *  - range: "TabName!A1:ZZ" (if your sheet tab isn't "Products")
 */
export async function fetchProducts(params?: {
  q?: string;
  category?: string;
  range?: string;
}): Promise<Product[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.category) qs.set("category", params.category);
  if (params?.range) qs.set("range", params.range);

  const url = `/.netlify/functions/sheets${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API failed: ${res.status}`);
  const data = await res.json();
  return (data.items ?? []) as Product[];
}
