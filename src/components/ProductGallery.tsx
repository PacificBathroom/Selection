// src/components/ProductGallery.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ClientInfo, Product } from "../types";
import { fetchProducts } from "../api/sheets";
import { exportDeckFromProducts } from "../utils/pptExporter";

type Props = {
  client: ClientInfo;
  range?: string; // e.g. "Products!A1:ZZ"
};

/** Stable key builder – tries several columns before falling back to index */
function productKey(p: any, index: number): string {
  const cand =
    p?.id ??
    p?._id ??
    p?._row ??
    p?.row ??
    p?.Row ??
    p?.sku ??
    p?.SKU ??
    p?.code ??
    p?.Code ??
    p?.url ??
    p?.Url ??
    p?.source_url ??
    p?.SourceURL ??
    p?.imageurl ??
    p?.ImageURL ??
    p?.image ??
    p?.name ??
    p?.Name ??
    p?.product ??
    p?.Product ??
    null;
  return String(cand ?? `idx#${index}`);
}

export default function ProductGallery({ client, range }: Props) {
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Record<string, Product>>({});
  const [sortBy, setSortBy] = useState<"sheet" | "name" | "category">("sheet");

  // initial load
  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetchProducts({ q: search, category, range });
      setItems(res);
    } catch (e: any) {
      console.error(e);
      setItems([]);
      setErrorMsg(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [search, category, range]);

  const categories = useMemo(() => {
    const s = new Set(
      (items as any[]).map((i) => String(i.category ?? i.Category ?? "").trim()).filter(Boolean)
    );
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visibleItems = useMemo(() => {
    const arr = [...items] as any[];
    if (sortBy === "name") {
      arr.sort((a, b) =>
        String(a.product ?? a.name ?? "").localeCompare(String(b.product ?? b.name ?? ""))
      );
    } else if (sortBy === "category") {
      arr.sort((a, b) => String(a.category ?? "").localeCompare(String(b.category ?? "")));
    }
    return arr;
  }, [items, sortBy]);

  const toggle = useCallback((p: Product, index: number) => {
    const key = productKey(p as any, index);
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = p;
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (p: Product, index: number) => Boolean(selected[productKey(p as any, index)]),
    [selected]
  );

  const selectedList = useMemo(() => Object.values(selected), [selected]);

  const onExport = useCallback(async () => {
    if (selectedList.length === 0) return;
    try {
      setExporting(true);
      // pass the RAW rows so pptExporter can read ImageURL, PdfURL, etc.
      await exportDeckFromProducts({ client, products: selectedList as any });
    } catch (e: any) {
      console.error(e);
      alert(`Export failed: ${e?.message || e}`);
    } finally {
      setExporting(false);
    }
  }, [client, selectedList]);

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products, SKU, description…"
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

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="border rounded-xl px-3 py-2 text-sm"
        >
          <option value="sheet">Sheet order</option>
          <option value="name">Name A–Z</option>
          <option value="category">Category A–Z</option>
        </select>

        <button
          type="button"
          onClick={runSearch}
          disabled={loading}
          className="px-3 py-2 text-sm rounded-lg border hover:bg-slate-50 disabled:opacity-50"
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
            disabled={exporting || selectedList.length === 0}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export PPTX"}
          </button>
        </div>
      </div>

      {/* Grid */}
      {errorMsg ? (
        <div className="text-sm text-red-600">Error: {errorMsg}</div>
      ) : loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : visibleItems.length === 0 ? (
        <p className="text-sm text-slate-500">No products found.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visibleItems.map((p: any, i: number) => {
            const key = productKey(p, i);
            const checked = isSelected(p, i);
            const title = String(p.product ?? p.name ?? "Untitled");
            const thumb = String(p.thumbnail ?? p.imageurl ?? p.image ?? "");

            const onCardClick = (e: React.MouseEvent) => {
              // ignore clicks on the checkbox itself
              const tag = (e.target as HTMLElement).tagName.toLowerCase();
              if (tag === "input" || tag === "button" || tag === "a") return;
              toggle(p, i);
            };

            return (
              <li
                key={key}
                onClick={onCardClick}
                className={`border rounded-2xl p-3 cursor-pointer transition ring-offset-2 ${
                  checked ? "ring-2 ring-blue-500" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p, i)}
                    aria-label={`Select ${title}`}
                    className="mt-1"
                  />

                  {thumb ? (
                    <img
                      src={thumb}
                      alt={title}
                      className="w-24 h-24 object-cover rounded-xl flex-none"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-slate-100 rounded-xl flex-none" />
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Title at top */}
                    <div className="font-medium leading-5 truncate">{title}</div>
                    <div className="text-xs text-slate-500 space-x-2">
                      {p.sku && <span>SKU: {String(p.sku)}</span>}
                      {p.category && <span>Category: {String(p.category)}</span>}
                    </div>
                    {p.description ? (
                      <p className="mt-1 text-sm text-slate-700 line-clamp-2">
                        {String(p.description)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}