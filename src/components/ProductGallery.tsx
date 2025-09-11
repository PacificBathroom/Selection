// src/components/ProductGallery.tsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchProducts } from "../api/sheets";
import type { Product, ClientInfo } from "../types";
import { exportDeckFromProducts } from "../utils/pptExporter";

export default function ProductGallery({ client }: { client: ClientInfo }) {
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Record<string, Product>>({}); // key by SKU or name

  useEffect(() => {
    fetchProducts({ q: search, category }).then(setItems).catch(console.error);
  }, [search, category]);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => String(i.category || "").trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const toggle = (p: Product) => {
    const key = String(p.sku || p.code || p.Code || p.product || Math.random());
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = p;
      return next;
    });
  };

  const selectedList = useMemo(() => Object.values(selected), [selected]);

  const onExport = async () => {
    if (selectedList.length === 0) {
      alert("Select at least one product.");
      return;
    }
    await exportDeckFromProducts({ client, products: selectedList });
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products, SKU, description, client…"
          className="border rounded-xl px-3 py-2 text-sm w-full sm:w-80"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-600">
            Selected: <strong>{selectedList.length}</strong>
          </span>
          <button
            type="button"
            onClick={onExport}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Export PPTX
          </button>
        </div>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No products found.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((p, i) => {
            const key = String(p.sku || p.code || p.Code || p.product || i);
            const checked = Boolean(selected[key]);
            const title = String(p.product || p.name || "Untitled");

            const price =
              p.price != null && String(p.price).trim() !== ""
                ? typeof p.price === "number"
                  ? `$${p.price.toFixed(2)}`
                  : String(p.price)
                : "";

            return (
              <li key={key} className="border rounded-2xl p-3 flex gap-3">
                {/* Checkbox column */}
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p)}
                    aria-label={`Select ${title}`}
                  />
                </div>

                {/* Thumb + info */}
                {p.thumbnail ? (
                  <img
                    src={String(p.thumbnail)}
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
                    {p.sku && <span>SKU: {String(p.sku)}</span>}
                    {p.category && <span>Category: {String(p.category)}</span>}
                  </div>

                  {price && <div className="mt-1 font-semibold">{price}</div>}

                  {p.description ? (
                    <p className="mt-1 text-sm text-slate-700 line-clamp-2">
                      {String(p.description)}
                    </p>
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
