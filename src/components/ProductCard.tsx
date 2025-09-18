import React from "react";
import type { Product } from "../types";

type Props = {
  product: Product;
  onSelect?: (p: Product) => void;
};

const getImage = (p: Product) =>
  String(p.imageUrl || p.thumbnail || p.image || "");

const getTitle = (p: Product) =>
  String(p.product || p.name || "").trim() || "Untitled product";

const ProductCard: React.FC<Props> = ({ product, onSelect }) => {
  const title = getTitle(product);
  const img = getImage(product);
  const sku = product.sku || product.code || "";
  const category = product.category || "";
  const hasPrice = product.price != null && String(product.price).trim() !== "";
  const price =
    typeof product.price === "number"
      ? `$${product.price.toFixed(2)}`
      : String(product.price || "");

  return (
    <div className="border rounded-2xl p-3 flex gap-3 hover:shadow-sm bg-white">
      {/* Thumbnail */}
      {img ? (
        <img
          src={img}
          alt={title}
          className="w-24 h-24 object-cover rounded-xl"
          loading="lazy"
        />
      ) : (
        <div className="w-24 h-24 bg-slate-100 rounded-xl" />
      )}

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{title}</div>

        <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-0.5">
          {sku && <span>SKU: {sku}</span>}
          {category && <span>Category: {category}</span>}
        </div>

        {hasPrice && <div className="mt-1 font-semibold">{price}</div>}

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
