// src/components/ProductGallery.tsx
import { useEffect, useMemo, useState } from "react";
import { fetchProducts, type ProductRow } from "../api/sheets";
import { PptLookCard } from "./PptLookCard";

export default function ProductGallery() {
  const [items, setItems] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => { fetchProducts({ q: search, category }).then(setItems).catch(console.error); }, [search, category]);

  const categories = useMemo(() => {
    const s = new Set(items.map(i => (i.category||"").toString().trim()).filter(Boolean));
    return Array.from(s).sort((a,b)=>a.localeCompare(b));
  }, [items]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products, SKU, description, client…"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid #E5E7EB" }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #E5E7EB" }}
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {items.map((p, i) => (
          <PptLookCard key={`${p.sku || p.product || i}`} p={p} logoUrl="/brand/logo.png" />
        ))}
      </div>
    </div>
  );
}
