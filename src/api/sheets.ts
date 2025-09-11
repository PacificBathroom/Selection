export type ProductRow = {
  product?: string; sku?: string; price?: number|string; category?: string;
  thumbnail?: string; description?: string; client_name?: string; pdf_url?: string;
  [k: string]: any;
};
export async function fetchProducts(params?: { q?: string; category?: string; }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.category) qs.set("category", params.category);
  const res = await fetch(`/.netlify/functions/sheets${qs.toString() ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Sheets API failed: ${res.status}`);
  return (await res.json()).items as ProductRow[];
}
