// src/components/ProductGallery.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { ClientInfo, Product } from "../types";
import { fetchProducts } from "../api/sheets";
import { exportDeckFromProducts } from "../utils/pptExporter";

type Props = {
  client: ClientInfo;
  range?: string; // e.g. "Products!A1:ZZ"
};

// Build a stable key that won’t change when the list is re-sorted or filtered.
function productKey(p: any): string {
  const cands = [
    p.id, p._id, p._row, p.row, p.Row, p.__row,
    p.sku, p.SKU,
    p.code, p.Code,
    p.url, p.Url, p.source_url, p.SourceURL,
  ].filter((v) => typeof v === "string" && v.trim() !== "");
  if (cands.length) return String(cands[0]);

  // Fallback: compose from relatively stable fields
  const name = String(p.product ?? p.Product ?? p.name ?? p.Name ?? "").trim();
  const code = String(p.sku ?? p.SKU ?? p.code ?? p.Code ?? "").trim();
  if (name || code) return `${name}#${code}`.toLowerCase();

  // Final fallback (rare): hash a few columns so it’s still stable per row content
  const img = String(p.ImageURL ?? p.imageurl ?? p.image ?? "").trim();
  const pdf = String(p.PdfURL ?? p["PDF URL"] ?? p.SpecUrl ?? p.SpecsUrl ?? "").trim();
  return `row#${[name, code, img, pdf].join("|").toLowerCase()}`;
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

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch() {
    try {
      setLoading(true);
      setErrorMsg(null);
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
      items.map((i: any) => String(i.category || i.Category || "").trim()).filter(Boolean)
    );
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visibleItems = useMemo(() => {
    const arr = [...items];
    if (sortBy === "name") {
      arr.sort((a: any, b: any) =>
        String(a.product || a.name || "").localeCompare(String(b.product || b.name || ""))
      );
    } else if (sortBy === "category") {
      arr.sort((a: any, b: any) =>
        String(a.category || "").localeCompare(String(b.category || ""))
      );
    }
    return arr;
  }, [items, sortBy]);

  const toggle = (p: Product) => {
    const key = productKey(p as any);
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
      // Pass the RAW rows straight through to the exporter
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
      {/* controls */}
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
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "sheet" | "name" | "category")}
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

      {/* grid */}
      {errorMsg ? (
        <div className="text-sm text-red-600">Error: {errorMsg}</div>
      ) : loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : visibleItems.length === 0 ? (
        <p className="text-sm text-slate-500">No products found.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visibleItems.map((p) => {
            const key = productKey(p as any);
            const checked = Boolean(selected[key]);
            const title = String((p as any).product || (p as any).name || "Untitled");

            // Thumbnail aliases: now includes ImageURL (matches exporter)
            const thumb =
              (p as any).thumbnail ??
              (p as any).imageurl ??
              (p as any).ImageURL ??
              (p as any).image ??
              "";

            return (
              <li
                key={key}
                className={`border rounded-2xl p-3 flex gap-3 ${checked ? "ring-2 ring-blue-500" : ""}`}
              >
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p)}
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
                    {(p as any).sku && <span>SKU: {String((p as any).sku)}</span>}
                    {(p as any).category && <span>Category: {String((p as any).category)}</span>}
                  </div>
                  {(p as any).description ? (
                    <p className="mt-1 text-sm text-slate-700 line-clamp-2">
                      {String((p as any).description)}
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