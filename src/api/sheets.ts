// src/api/sheets.ts
export type ProductRow = {
  product?: string; sku?: string; price?: number|string; category?: string;
  thumbnail?: string; description?: string; client_name?: string; pdf_url?: string;
  [k: string]: any;
};

export async function fetchProducts(params?: { q?: string; category?: string; range?: string }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.category) qs.set("category", params.category);
  if (params?.range) qs.set("range", params.range); // <--- NEW
  const res = await fetch(`/.netlify/functions/sheets${qs.toString() ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Sheets API failed: ${res.status}`);
  const data = await res.json();
  return (data.items || []) as ProductRow[];
}
