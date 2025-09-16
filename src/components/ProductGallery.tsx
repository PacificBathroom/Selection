// src/components/ProductGallery.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { ClientInfo, Product } from "../types";
import { fetchProducts } from "../api/sheets";
import { exportDeckFromProducts } from "../utils/pptExporter";

// --- small helper: quick hash so we never collide ---
function hash(str: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

// A stable unique key for each product row.
// Order of preference: id/_id/_row/code/SKU/url → name+index → hashed fallback
function productKeyOf(p: any, i: number): string {
  const candidates = [
    p.id, p._id, p._row, p.row,
    p.sku, p.SKU, p.code, p.Code,
    p.url, p.Url, p.source_url, p.SourceURL,
  ].filter((v) => typeof v === "string" && v.trim() !== "");
  if (candidates.length) return candidates[0].trim();

  const name = String(p.product ?? p.name ?? "").trim();
  if (name) return `${name}#${i}`;

  // final fallback: stable-ish hash of serialized row + index
  return `row#${hash(JSON.stringify(p))}#${i}`;
}

type Props = {
  client: ClientInfo;
  range?: string; // e.g. "Products!A1:ZZ"
};

export default function ProductGallery({ client, range }: Props) {
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Use a map of key -> product for multi-select
  const [selected, setSelected] = useState<Record<string, Product>>({});
  const selectedList = useMemo(() => Object.values(selected), [selected]);

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch() {
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
  }

  const categories = useMemo(() => {
    const s = new Set(
      items
        .map((i: any) => String(i.category || i.Category || "").trim())
        .filter(Boolean)
    );
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const [sortBy, setSortBy] = useState<"sheet" | "name" | "category">("sheet");
  const visibleItems = useMemo(() => {
    const arr = [...items];
    if (sortBy === "name") {
      arr.sort((a: any, b: any) =>
        String(a.product || a.name || "").localeCompare(
          String(b.product || b.name || "")
        )
      );
    } else if (sortBy === "category") {
      arr.sort((a: any, b: any) =>
        String(a.category || "").localeCompare(String(b.category || ""))
      );
    }
    return arr;
  }, [items, sortBy]);

  function toggle(p: Product, index: number, e?: React.ChangeEvent<HTMLInputElement>) {
    // Prevent any bubbling that might trigger parent handlers
    if (e) e.stopPropagation();
    const key = productKeyOf(p as any, index);
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = p;
      return next;
    });
  }

  function onCardClick(p: Product, index: number) {
    // Only toggle when clicking the card background, not links/controls
    toggle(p, index);
  }

  async function onExport() {
    if (selectedList.length === 0) {
      alert("Select at least one product.");
      return;
    }
    try {
      setExporting(true);
      await exportDeckFromProducts({ client, products: selectedList });
    } catch (e: any) {
      console.error(e);
      alert(`Export failed: ${e?.message || e}`);
    } finally {
      setExporting(false);
    }
  }

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
            <option key={c} value={c}>{c}</option>
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

      {/* Grid */}
      {errorMsg ? (
        <div className="text-sm text-red-600">Error: {errorMsg}</div>
      ) : loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : visibleItems.length === 0 ? (
        <p className="text-sm text-slate-500">No products found.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visibleItems.map((p, i) => {
            const key = productKeyOf(p as any, i);
            const checked = Boolean(selected[key]);
            const title = String((p as any).product || (p as any).name || "Untitled");
            const thumb =
              (p as any).thumbnail || (p as any).imageurl || (p as any).image || "";

            // Unique checkbox id so labels don’t cross-wire
            const cbId = `select-${hash(key)}-${i}`;

            return (
              <li
                key={key}
                onClick={(e) => {
                  // only toggle when clicking card background
                  if ((e.target as HTMLElement).closest("input,button,a,select,textarea")) return;
                  onCardClick(p, i);
                }}
                className={`border rounded-2xl p-3 flex gap-3 transition ring-offset-2 ${
                  checked ? "ring-2 ring-blue-500" : ""
                }`}
                data-selected={checked ? "1" : "0"}
              >
                <div className="pt-1">
                  <input
                    id={cbId}
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggle(p, i, e)}
                    aria-label={`Select ${title}`}
                  />
                </div>

                {thumb ? (
                  <img
                    src={String(thumb)}
                    alt={title}
                    className="w-24 h-24 object-cover rounded-xl pointer-events-none select-none"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-24 h-24 bg-slate-100 rounded-xl" />
                )}

                <div className="flex-1 min-w-0">
                  <label htmlFor={cbId} className="font-medium truncate cursor-pointer">
                    {title}
                  </label>
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
