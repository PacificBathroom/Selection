import React from "react";
import type { Product } from "@/types";

type Props = {
  product: Product;
  onSelect?: (p: Product) => void;
};

const ProductCard: React.FC<Props> = ({ product, onSelect }) => {
  const title = product.name?.toString() || "Untitled";
  const category = product.category?.toString() || "";
  const code = product.code?.toString() || "";
  const img = product.imageUrl || product.image || "";

  return (
    <div className="border rounded-2xl p-3 flex gap-3 hover:shadow transition">
      {/* Image */}
      {img ? (
        <img
          src={img}
          alt={title}
          className="w-24 h-24 object-cover rounded-xl bg-slate-50"
          loading="lazy"
        />
      ) : (
        <div className="w-24 h-24 rounded-xl bg-slate-100" />
      )}

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{title}</div>

        <div className="text-xs text-slate-500 space-x-2">
          {code && <span>Code: {code}</span>}
          {category && <span>Category: {category}</span>}
        </div>

        {product.description ? (
          <p className="mt-1 text-sm text-slate-700 line-clamp-2">
            {String(product.description)}
          </p>
        ) : null}

        {onSelect ? (
          <button
            type="button"
            className="mt-2 text-sm px-3 py-1 rounded-lg border hover:bg-slate-50"
            onClick={() => onSelect(product)}
          >
            Select
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default ProductCard;
