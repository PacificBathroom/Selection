// src/App.tsx
import React, { useState } from "react";
import Header from "./components/Header";
import ProjectDetailsCard from "./components/ProjectDetailsCard";
import ProductGallery from "./components/ProductGallery";
import type { ClientInfo } from "./types";
import { useProducts } from "./hooks/useProducts";

<div className="toolbar">
  <input className="search" ... />
  <select className="cat" value={cat} onChange={e=>setCat(e.target.value)}>
    {categories.map(c => <option key={c} value={c}>{c}</option>)}
  </select>
  <select className="sort" value={sort} onChange={e=>setSort(e.target.value as any)}>
    <option value="sheet">Sheet order</option>
    <option value="name">Name (A–Z)</option>
  </select>
  <div className="spacer" />
  <div className="muted">Selected: {selectedList.length}</div>
  <button className="primary" onClick={exportPptx}>Export PPTX</button>
</div>


export default function App() {
  const [client, setClient] = useState<ClientInfo>({
    clientName: "",
    projectName: "Project Selection",
    dateISO: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });

  const { products, loading, error } = useProducts();

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <ProjectDetailsCard client={client} setClient={setClient} />

        {loading && <div>Loading products…</div>}
        {error && <div className="text-red-600">Error: {error}</div>}
        {!loading && !error && (
          <ProductGallery client={client} products={products} />
        )}
      </main>
    </div>
  );
}
