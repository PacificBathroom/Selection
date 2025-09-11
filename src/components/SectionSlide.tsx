// src/components/SectionSlide.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Section } from "../types";
import { fetchProducts, type ProductRow } from "../api/sheets";

// Props: the parent (SectionsDeck) passes a single section.
// Optionally you can receive a callback when a product is chosen.
type Props = {
  section: Section;
  onSelectProduct?: (p: ProductRow) => void;
};

export default function SectionSlide({ section, onSelectProduct }: Props) {
  // Local search/filter state for this section view
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<ProductRow[]>([]);

  // Load from Google Sheets via the Netlify function
  useEffect(() => {
    fetchProducts({ q: search, category }).then(setItems).catch(console.error);
  }, [search, category]);

  // Build category list from the rows
  const categories = useMemo(() => {
    const s = new Set(
      items.map((i) => (i.category || "").toString().trim()).filter(Boolean)
    );
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{section.title}</h3>

        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, SKU, description…"
            className="border rounded-lg px-3 py-2 text-sm w-64"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No products found.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((p, i) => (
            <li
              key={`${p.sku || p.product || i}`}
              className="border rounded-2xl p-3 flex gap-3 hover:shadow"
            >
              {p.thumbnail ? (
                <img
                  src={String(p.thumbnail)}
                  alt={String(p.product || "Product")}
                  className="w-24 h-24 object-cover rounded-xl"
                  loading="lazy"
                />
              ) : (
                <div className="w-24 h-24 bg-slate-100 rounded-xl" />
              )}

              <div className="flex-1">
                <div className="font-medium">{p.product || "Untitled"}</div>
                {p.sku ? (
                  <div className="text-xs text-slate-500">SKU: {p.sku}</div>
                ) : null}
                {p.category ? (
                  <div className="text-xs text-slate-500">
                    Category: {p.category}
                  </div>
                ) : null}
                {p.price != null && String(p.price).trim() !== "" ? (
                  <div className="mt-1 font-semibold">
                    {typeof p.price === "number" ? `$${p.price.toFixed(2)}` : p.price}
                  </div>
                ) : null}

                {onSelectProduct ? (
                  <button
                    className="mt-2 text-sm px-3 py-1 rounded-lg border hover:bg-slate-50"
                    onClick={() => onSelectProduct(p)}
                  >
                    Add to {section.title}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
