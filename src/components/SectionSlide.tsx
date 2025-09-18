import React, { useEffect, useMemo, useState } from "react";
import type { Section } from "../types";
import { fetchProducts, type ProductRow } from "../api/sheets";
import ProductCard from "./ProductCard";

type Props = {
  section: Section;
  onSelectProduct?: (p: ProductRow) => void;
  onUpdate?: (next: Section) => void;
};

export default function SectionSlide({ section, onSelectProduct }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // add on top with aliases
// const H = { ..., SOURCE: ["url", "link"] as const, }

// inside toProduct(..)
const source = pickByHeader(row, H.SOURCE);
// ...
sourceUrl: source ? String(source) : undefined,


  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    fetchProducts({ q: search, category })
      .then((rows) => {
        if (alive) setItems(rows);
      })
      .catch((e) => {
        if (alive) setErr(e?.message || "Failed to load products");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [search, category]);

  const categories = useMemo(() => {
    const s = new Set(
      items.map((i) => (i.category || "").toString().trim()).filter(Boolean)
    );
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="text-lg font-semibold">{section.title}</h3>

        <div className="flex gap-2 flex-wrap">
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

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : err ? (
        <p className="text-sm text-red-600">Error: {err}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">No products found.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((p, i) => (
            <li key={`${p.sku || p.code || p.product || p.name || i}`}>
              <ProductCard product={p} onSelect={onSelectProduct} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
