// src/hooks/useProducts.ts
import { useEffect, useState } from "react";
import type { Product } from "../types";
import { fetchProducts, type ProductFilter } from "../api/sheets";

export function useProducts(filter: ProductFilter = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchProducts(filter)
      .then((items) => {
        if (cancelled) return;
        // ensure a stable id
        const withIds = items.map((p, i) => ({
          ...p,
          id: p.id ?? String(p.code ?? p.url ?? p.name ?? `row-${i + 2}`),
        }));
        setProducts(withIds);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [JSON.stringify(filter)]);

  return { products, loading, error };
}