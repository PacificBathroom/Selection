// src/components/SectionSlide.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Section } from "../types";
import { fetchProducts, type ProductRow } from "../api/sheets";

type Props = {
  section: Section;
  onSelectProduct?: (p: ProductRow) => void;
  onUpdate?: (next: Section) => void;
};

export default function SectionSlide({ section, onSelectProduct }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<ProductRow[]>([]);

  useEffect(() => {
    fetchProducts({ q: search, category }).then(setItems).catch(console.error);
  }, [search, category]);

  const categories = useMemo(() => {
    const s = new Set(items.map((i) => (i.category || "").toString().trim()).filter(Boolean));
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
            placeholder="Search products, code, description…"
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
          {items.map((p, i) => {
            const title = p.name ?? p.product?.name ?? "Untitled";
            const thumb = p.thumbnail ?? p.imageUrl ?? p.image;
            const sku = p.sku ? String(p.sku) : p.code ? String(p.code) : "";

            const priceText =
              p.price != null && String(p.price).trim() !== ""
                ? typeof p.price === "number"
                  ? `$${p.price.toFixed(2)}`
                  : String(p.price)
                : "";

            return (
              <li
                key={String(p.sku ?? p.code ?? p.name ?? i)}
                className="border rounded-2xl p-3 flex gap-3 hover:shadow"
              >
                {thumb ? (
                  <img
                    src={String(thumb)}
                    alt={title}
                    className="w-24 h-24 object-cover rounded-xl"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-24 h-24 bg-slate-100 rounded-xl" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{title}</div>
                  <div className="text-xs text-slate-500 space-x-2">
                    {sku && <span>SKU/Code: {sku}</span>}
                    {p.category && <span>Category: {p.category}</span>}
                  </div>

                  {priceText && <div className="mt-1 font-semibold">{priceText}</div>}

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
            );
          })}
        </ul>
      )}
    </section>
  );
}
