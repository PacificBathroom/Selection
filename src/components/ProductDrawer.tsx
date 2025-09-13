// src/components/ProductDrawer.tsx
import React from "react";
import type { Section, Product } from "../types";

type Props = {
  open?: boolean;
  section?: Section | null;
  onClose?: () => void;
  onUpdate?: (next: Section) => void;
};

function normalizeProducts(section?: Section | null): Product[] {
  if (!section) return [];
  if (Array.isArray(section.products)) return section.products;
  if (section.product) return [section.product];
  return [];
}

export default function ProductDrawer({
  open = false,
  section = null,
  onClose,
  onUpdate,
}: Props) {
  if (!open) return null;

  const products = normalizeProducts(section);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next: Section = { ...(section || {}), title: e.target.value };
    onUpdate?.(next);
  };

  const removeAt = (idx: number) => {
    const nextProducts = products.slice();
    nextProducts.splice(idx, 1);
    const next: Section = { ...(section || {}), products: nextProducts };
    // clear legacy single `product` if we’re switching to array form
    delete (next as any).product;
    onUpdate?.(next);
  };

  const thumbFrom = (p: Product): string => {
    // try common image fields without being strict about casing/names
    const cands = [
      (p as any).Thumbnail,
      (p as any).thumbnail,
      (p as any).ImageURL,
      (p as any).ImageUrl,
      (p as any).imageUrl,
      (p as any).imageurl,
      p.image,
    ];
    const first = cands.find((v) => typeof v === "string" && v.trim() !== "");
    return String(first || "");
  };

  const titleFrom = (p: Product): string => {
    const cands = [
      (p as any).Name,
      (p as any).Product,
      p.name,
      (p as any).product,
      "Untitled",
    ];
    const first = cands.find((v) => typeof v === "string" && v.trim() !== "");
    return String(first);
  };

  const codeFrom = (p: Product): string => {
    const cands = [p.code, (p as any).Code, p.sku, (p as any).SKU];
    const first = cands.find((v) => v != null && String(v).trim() !== "");
    return first != null ? String(first) : "";
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Section</h2>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
        </div>

        <label className="block text-sm text-slate-600 mb-1">Title</label>
        <input
          className="w-full border rounded px-3 py-2 mb-4"
          value={section?.title || ""}
          onChange={handleTitleChange}
          placeholder="Section title"
        />

        <div className="space-y-3">
          {products.length === 0 ? (
            <div className="text-sm text-slate-500">
              No products in this section.
            </div>
          ) : (
            products.map((p: Product, i: number) => {
              const thumb = thumbFrom(p);
              const title = titleFrom(p);
              const code = codeFrom(p);
              const desc =
                typeof p.description === "string"
                  ? p.description
                  : (p as any).Description || "";

              return (
                <div
                  key={`${title}-${i}`}
                  className="border rounded-lg p-3 flex gap-3 items-start"
                >
                  <div className="w-16 h-16 bg-slate-100 rounded overflow-hidden shrink-0">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{title}</div>
                    {(code && (
                      <div className="text-xs text-slate-500">Code: {code}</div>
                    )) ||
                      null}
                    {desc && (
                      <div className="mt-1 text-sm line-clamp-2">{desc}</div>
                    )}
                  </div>

                  <button
                    className="text-sm text-red-600 hover:text-red-700"
                    onClick={() => removeAt(i)}
                  >
                    Remove
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}