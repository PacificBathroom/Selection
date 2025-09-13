// src/components/ProductGallery.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { ClientInfo } from "../types";
import { fetchProducts } from "../api/sheets";
import { exportDeckFromProducts } from "../utils/pptExporter";

type Props = {
  client: ClientInfo;      // pass from App/Header state
  range?: string;          // optional: e.g. "Products!A1:Z"
};

export default function ProductGallery({ client, range }: Props) {
  // Use 'any' to preserve ALL original sheet columns (ImageURL, PdfURL, etc.)
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Record<string, any>>({});
  const [sortBy, setSortBy] = useState<"sheet" | "name" | "category">("sheet");

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch() {
    try {
      setLoading(true);
      setErrorMsg(null);
      // IMPORTANT: fetchProducts should return raw rows (original headers)
      const res = await fetchProducts({ q: search, category, range });
      setItems(res || []);
    } catch (e: any) {
      console.error(e);
      setItems([]);
      setErrorMsg(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const categories = useMemo(() => {
    const s = new Set(
      items.map((i) => String(i?.category || i?.Category || "").trim()).filter(Boolean)
    );
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visibleItems = useMemo(() => {
    const arr = [...items];
    if (sortBy === "name") {
      arr.sort((a, b) =>
        String(a?.product || a?.Product || a?.name || "").localeCompare(
          String(b?.product || b?.Product || b?.name || "")
        )
      );
    } else if (sortBy === "category") {
      arr.sort((a, b) =>
        String(a?.category || a?.Category || "").localeCompare(
          String(b?.category || b?.Category || "")
        )
      );
    }
    return arr;
  }, [items, sortBy]);

  const keyFor = (p: any, index: number) =>
    String(
      p?.sku ?? p?.SKU ?? p?.code ?? p?.Code ?? p?.product ?? p?.Product ?? index
    );

  const toggle = (p: any, index: number) => {
    const key = keyFor(p, index);
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
    try {
      setExporting(true);
      // CRITICAL: pass RAW rows directly; do not remap/destroy fields
      await exportDeckFromProducts({ client, products: selectedList });
    } catch (e: any) {
      console.error(e);
      alert(`Export failed: ${e?.message || e}`);
    } finally {
      setExporting(false);
    }
  };

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
          onChange={(e) =>
            setSortBy(e.target.value as "sheet" | "name" | "category")
          }
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
            disabled={exporting}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export PPTX"}
          </button>
        </div>
      </div>

      {/* Error / Empty / Grid */}
      {errorMsg ? (
        <div className="text-sm text-red-600">Error: {errorMsg}</div>
      ) : loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : visibleItems.length === 0 ? (
        <p className="text-sm text-slate-500">No products found.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visibleItems.map((p, i) => {
            const key = keyFor(p, i);
            const checked = Boolean(selected[key]);
            const title = String(p?.product || p?.Product || p?.name || "Untitled");

            const thumb =
              p?.thumbnail ?? p?.Thumbnail ?? p?.imageurl ?? p?.ImageURL ?? p?.image ?? "";

            return (
              <li
                key={key}
                className={`border rounded-2xl p-3 flex gap-3 ${checked ? "ring-2 ring-blue-500" : ""}`}
              >
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p, i)}
                    aria-label={`Select ${title}`}
                  />
                </div>

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
                    {p?.sku && <span>SKU: {String(p.sku)}</span>}
                    {p?.code && <span>Code: {String(p.code)}</span>}
                    {(p?.category || p?.Category) && (
                      <span>Category: {String(p?.category || p?.Category)}</span>
                    )}
                  </div>
                  {p?.description && (
                    <p className="mt-1 text-sm text-slate-700 line-clamp-2">
                      {String(p.description)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}