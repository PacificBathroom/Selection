// src/components/ProductGallery.tsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchProducts } from "../api/sheets";
import type { Product, ClientInfo } from "../types";
import { exportDeckFromProducts } from "../utils/pptExporter";

type Props = {
  client: ClientInfo;
  /** Optional: if your tab is not "Products", pass "MyTab!A1:ZZ" */
  range?: string;
};

export default function <ProductGallery client={client} range="Sheet1!A1:ZZ" />
 Props) {
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, Product>>({});

  // Build categories from the current list
  const categories = useMemo(() => {
    const s = new Set(items.map((i) => String(i.category || "").trim()).filter(Boolean));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Run an initial load (blank search) so the grid isn't empty on first visit
  useEffect(() => {
    (async () => {
      await runSearch();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch() {
    try {
      setLoading(true);
      setErr(null);
      // fetchProducts already builds the query string; extend to pass range if provided
      const res = await fetchProducts({ q: search, category, range });
      setItems(res);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const toggle = (p: Product, index: number) => {
    const key = String(p.sku || (p as any).code || (p as any).Code || p.product || index);
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

        <button
          type="button"
          onClick={runSearch}
          disabled={loading}
          className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>

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

      {/* Error / Empty / Grid */}
      {err ? (
        <div className="text-sm text-red-600">Error: {err}</div>
      ) : loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">No products found.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((p, i) => {
            const key = String(p.sku || (p as any).code || (p as any).Code || p.product || i);
            const checked = Boolean(selected[key]);
            const title = String(p.product || (p as any).name || "Untitled");

            const price =
              p.price != null && String(p.price).trim() !== ""
                ? typeof p.price === "number"
                  ? `$${p.price.toFixed(2)}`
                  : String(p.price)
                : "";

            return (
              <li key={key} className="border rounded-2xl p-3 flex gap-3">
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p, i)}
                    aria-label={`Select ${title}`}
                  />
                </div>

               const thumb =
  (p as any).thumbnail ||
  (p as any).imageurl ||
  (p as any).image ||
  "";

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
