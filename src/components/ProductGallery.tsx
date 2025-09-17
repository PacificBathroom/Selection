// src/components/ProductGallery.tsx
import React, { useMemo, useState } from "react";
import type { ClientInfo, Product } from "../types";
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
function productKeyOf(p: any, i: number): string {
  const candidates = [
    p.id, p._id, p._row, p.row,
    p.sku, p.SKU, p.code, p.Code,
    p.url, p.Url, p.source_url, p.SourceURL,
  ].filter((v) => typeof v === "string" && v.trim() !== "");
  if (candidates.length) return candidates[0].trim();

  const name = String(p.product ?? p.name ?? "").trim();
  if (name) return `${name}#${i}`;

  return `row#${hash(JSON.stringify(p))}#${i}`;
}

type Props = {
  client: ClientInfo;
  products: Product[];
};

export default function ProductGallery({ client, products }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [exporting, setExporting] = useState(false);

  // Selection state
  const [selected, setSelected] = useState<Record<string, Product>>({});
  const selectedList = useMemo(() => Object.values(selected), [selected]);

  // Filter + sort pipeline
  const categories = useMemo(() => {
    const s = new Set(
      products
        .map((i: any) => String(i.category || i.Category || "").trim())
        .filter(Boolean)
    );
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const [sortBy, setSortBy] = useState<"sheet" | "name" | "category">("sheet");

  const visibleItems = useMemo(() => {
    let arr = [...products];

    // search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((p) => {
        const hay = [
          p.name,
          p.product,
          p.code,
          p.sku,
          p.description,
          p.category,
        ]
          .filter(Boolean)
          .map(String)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    // category filter
    if (category.trim()) {
      arr = arr.filter(
        (p) =>
          String(p.category || "").trim().toLowerCase() ===
          category.trim().toLowerCase()
      );
    }

    // sorting
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
  }, [products, search, category, sortBy]);

  function toggle(p: Product, index: number, e?: React.ChangeEvent<HTMLInputElement>) {
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
      {visibleItems.length === 0 ? (
        <p className="text-sm text-slate-500">No products found.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visibleItems.map((p, i) => {
            const key = productKeyOf(p as any, i);
            const checked = Boolean(selected[key]);
            const title = String((p as any).product || (p as any).name || "Untitled");
            const thumb =
              (p as any).thumbnail || (p as any).imageUrl || (p as any).image || "";

            const cbId = `select-${hash(key)}-${i}`;

            return (
              <li
                key={key}
                onClick={(e) => {
                  if (
                    (e.target as HTMLElement).closest(
                      "input,button,a,select,textarea"
                    )
                  )
                    return;
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
                    {(p as any).category && (
                      <span>Category: {String((p as any).category)}</span>
                    )}
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
