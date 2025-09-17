// src/App.tsx
import React, { useState } from "react";
import Header from "./components/Header";
import ProjectDetailsCard from "./components/ProjectDetailsCard";
import ProductGallery from "./components/ProductGallery";
import type { ClientInfo } from "./types";
import { useProducts } from "./hooks/useProducts";

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
