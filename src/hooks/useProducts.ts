// src/hooks/useProducts.ts
// BEFORE (you likely had a local type Product here)
// type Product = { ... }

// AFTER: import the shared type
import type { Product } from "../types";

// When you map API rows, guarantee an id:
const withIds: Product[] = rows.map((p, i) => ({
  ...p,
  id: p.id ?? String(p.code ?? p.url ?? p.name ?? `row-${i + 2}`),
}));

import { useEffect, useState } from "react";

export type Product = {
  url?: string;
  code?: string;
  name?: string;
  image?: string;
  description?: string;
  specsBullets?: string[];
  pdfURL?: string;
  category?: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
};

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/products.json", { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Product[]) => setProducts(data))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return { products, loading, error };
}
