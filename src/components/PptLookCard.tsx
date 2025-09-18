import React from "react";
import type { ProductRow } from "../api/sheets";

export function PptLookCard({ p, logoUrl }: { p: ProductRow; logoUrl?: string }) {
  const title =
    String(p.product || p.name || "").trim() || "Untitled product";
  const img = String(p.imageUrl || p.thumbnail || p.image || "");
  const sku = p.sku || p.code;
  const price =
    p.price != null && String(p.price).trim() !== ""
      ? typeof p.price === "number"
        ? `$${p.price.toFixed(2)}`
        : String(p.price)
      : "";

  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 bg-white border rounded-2xl p-4 shadow-sm">
      {/* Image */}
      {img ? (
        <img
          src={img}
          alt={title}
          className="w-[140px] h-[140px] object-cover rounded-xl"
          loading="lazy"
        />
      ) : (
        <div className="w-[140px] h-[140px] rounded-xl bg-slate-100" />
      )}

      {/* Right column */}
      <div className="min-w-0">
        <div className="flex items-center justify-between mb-2 gap-3">
          <h3 className="text-slate-900 text-[20px] font-bold truncate m-0">
            {title}
          </h3>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-7 object-contain opacity-90"
            />
          ) : null}
        </div>

        <div className="text-xs text-slate-500 mb-2">
          {sku ? <>SKU: {sku} · </> : null}
          {p.category ? <>Category: {p.category}</> : null}
        </div>

        {p.description ? (
          <p className="m-0 text-slate-700 leading-snug">
            {String(p.description).slice(0, 220)}
            {String(p.description).length > 220 ? "…" : ""}
          </p>
        ) : null}

        {price && <div className="mt-2 font-bold">{price}</div>}
      </div>
    </div>
  );
}

export default PptLookCard;
