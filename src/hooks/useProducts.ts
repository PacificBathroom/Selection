// src/hooks/useProducts.ts
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
