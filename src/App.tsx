import React, { useState } from "react";
import Header from "./components/Header";                     // logo-only, no props
import ProjectDetailsCard from "./components/ProjectDetailsCard";
import ProductGallery from "./components/ProductGallery";
import type { ClientInfo } from "./types";

export default function App() {
  const [client, setClient] = useState<ClientInfo>({
    clientName: "",
    projectName: "Project Selection",
    dateISO: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <Header />                                              {/* ← no props */}
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <ProjectDetailsCard client={client} setClient={setClient} />
        <ProductGallery client={client} />                     {/* needed for export */}
      </main>
    </div>
  );
}
