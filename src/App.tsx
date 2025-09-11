import React, { useState } from "react";
import Header from "./components/Header"; // logo-only version we created
import ProjectDetailsCard from "./components/ProjectDetailsCard";
import ProductGallery from "./components/ProductGallery";
// import SectionsDeck from "./components/SectionsDeck"; // <- REMOVE
// import FrontPage from "./components/FrontPage";       // <- REMOVE
import type { ClientInfo } from "./types"; // Section type no longer needed

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
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Single details card (kept) */}
        <ProjectDetailsCard client={client} setClient={setClient} />

        {/* Single selection area (kept) */}
        <ProductGallery />
      </main>
    </div>
  );
}
