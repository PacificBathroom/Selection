// src/api/sheets.ts

/**
 * Fetch products (raw rows) from the Netlify Sheets function.
 * Returns the rows as-is, with all headers/columns intact.
 *
 * Optional params:
 *  - q: search query
 *  - category: exact category match
 *  - range: "TabName!A1:ZZ" (if your sheet tab isn't "Products")
 */
export async function fetchProducts(params?: {
  q?: string;
  category?: string;
  range?: string;
}): Promise<any[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.category) qs.set("category", params.category);
  if (params?.range) qs.set("range", params.range);

  const url = `/.netlify/functions/sheets${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API failed: ${res.status}`);

  const data = await res.json();

  // Return the rows exactly as they come back, no remapping
  return data.items ?? [];
}

// Optional alias if other files still import ProductRow
export type ProductRow = any;