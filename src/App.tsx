// src/App.tsx
import React, { useState } from "react";
import Header from "./components/Header";
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
      {/* Top header */}
      <Header client={client} setClient={setClient} />

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Project info card (where you type client details) */}
        <ProjectDetailsCard client={client} setClient={setClient} />

        {/* Gallery now has access to client info for export */}
        <ProductGallery client={client} />
      </main>
    </div>
  );
}
