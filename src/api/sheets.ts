// src/api/sheets.ts
import type { Product } from "../types";

export type ProductRow = Product; // compatibility

export async function fetchProducts(params?: {
  q?: string;
  category?: string;
}): Promise<Product[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.category) qs.set("category", params.category);

  const url = `/.netlify/functions/products${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Products API failed: ${res.status}`);
  const data = await res.json();
  return (data.items ?? []) as Product[];
}
