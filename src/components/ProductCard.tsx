import React from 'react';
import { Product } from '../types';
import Tag from './Tag';

type Props = { product: Product; onSelect: (p: Product) => void; };

export default function ProductCard({ product, onSelect }: Props) {
  return (
    <button onClick={() => onSelect(product)} className="group text-left w-full rounded-2xl bg-white border shadow-card overflow-hidden hover:shadow-lg transition">
      <div className="aspect-[4/3] w-full overflow-hidden">
        {product.image ? (<img src={product.image} alt={product.name} className="h-full w-full object-cover group-hover:scale-[1.02] transition" />) : (<div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm">No image</div>)}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold leading-tight">{product.name}</h3>
          {product.code && <span className="text-xs text-slate-500">{product.code}</span>}
        </div>
        {product.description && <p className="text-sm text-slate-600 line-clamp-2">{product.description}</p>}
        <div className="flex flex-wrap gap-1 pt-1">
          {product.tags?.slice(0,3).map(t => <Tag key={t}>{t}</Tag>)}
        </div>
      </div>
    </button>
  );
}
