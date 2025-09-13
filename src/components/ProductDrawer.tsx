// src/components/ProductDrawer.tsx
import React from "react";

type Props = {
  open?: boolean;
  section?: any;                         // legacy shape; keep loose
  onClose?: () => void;
  onUpdate?: (next: any) => void;        // keep flexible to avoid refactor
};

export default function ProductDrawer({
  open = false,
  section,
  onClose,
  onUpdate,
}: Props) {
  if (!open) return null;

  const products: any[] = Array.isArray(section?.products) ? section.products : [];

  const handleChangeTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...(section || {}), title: e.target.value };
    onUpdate?.(next);
  };

  const removeAt = (idx: number) => {
    const arr = products.slice();
    arr.splice(idx, 1);
    onUpdate?.({ ...(section || {}), products: arr });
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Section</h2>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-900">Close</button>
        </div>

        <label className="block text-sm text-slate-600 mb-1">Title</label>
        <input
          className="w-full border rounded px-3 py-2 mb-4"
          value={section?.title || ""}
          onChange={handleChangeTitle}
          placeholder="Section title"
        />

        <div className="space-y-3">
          {products.length === 0 ? (
            <div className="text-sm text-slate-500">No products in this section.</div>
          ) : (
            products.map((p: any, i: number) => (
              <div key={i} className="border rounded-lg p-3 flex gap-3 items-start">
                <div className="w-16 h-16 bg-slate-100 rounded overflow-hidden">
                  {p?.Thumbnail || p?.ImageURL || p?.image ? (
                    <img
                      src={String(p.Thumbnail || p.ImageURL || p.image)}
                      alt={String(p?.Name || p?.Product || "Product")}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {String(p?.Name || p?.Product || "Untitled")}
                  </div>
                  <div className="text-xs text-slate-500">
                    {p?.Code || p?.SKU ? `Code: ${String(p.Code || p.SKU)}` : ""}
                  </div>
                  {p?.Description && (
                    <div className="mt-1 text-sm line-clamp-2">{String(p.Description)}</div>
                  )}
                </div>
                <button
                  className="text-sm text-red-600 hover:text-red-700"
                  onClick={() => removeAt(i)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}