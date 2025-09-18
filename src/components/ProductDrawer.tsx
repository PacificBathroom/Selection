// src/components/ProductDrawer.tsx
import React from "react";
import type { Section, Product } from "../types";
import ProductCard from "./ProductCard";

type Props = {
  section: Section;
  onUpdate?: (next: Section) => void;
};

export default function ProductDrawer({ section, onUpdate }: Props) {
  const title: string = section.title ?? "";
  const products: Product[] = Array.isArray(section.products) ? section.products : [];

  const setTitle = (t: string) =>
    onUpdate?.({ id: section.id, title: t, products });

  const removeAt = (i: number) => {
    const next = products.filter((_, idx) => idx !== i);
    onUpdate?.({ id: section.id, title, products: next });
  };

  return (
    <aside className="p-4 border rounded-xl bg-white">
      <label className="block text-sm mb-2 font-medium">Section title</label>
      <input
        className="border rounded-lg px-3 py-2 w-full mb-4"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Tapware – Ensuite"
      />

      <div className="space-y-2">
        {products.length === 0 ? (
          <p className="text-sm text-slate-500">No products in this section yet.</p>
        ) : (
          products.map((p, i) => (
            <div key={(p.code || p.sku || p.name || p.product || "") + i} className="flex items-start gap-3">
              <div className="shrink-0">
                <ProductCard product={p} />
              </div>
              <button
                className="ml-auto text-sm text-red-600 hover:underline"
                onClick={() => removeAt(i)}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
