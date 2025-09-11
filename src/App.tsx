import React, { useState } from "react";
import Header from "./components/Header"; // now logo-only
import SectionsDeck from "./components/SectionsDeck";
import FrontPage from "./components/FrontPage";
import ProductGallery from "./components/ProductGallery";
import ProjectDetailsCard from "./components/ProjectDetailsCard";
import { Section, ClientInfo } from "./types";

export default function App() {
  const [sections, setSections] = useState<Section[]>([
    { id: crypto.randomUUID(), title: "Bathroom 1" },
    { id: crypto.randomUUID(), title: "Kitchen" },
    { id: crypto.randomUUID(), title: "Laundry" },
  ]);

  const [client, setClient] = useState<ClientInfo>({
    clientName: "",
    projectName: "Project Selection",
    dateISO: "", // keep as ISO (yyyy-mm-dd) for <input type="date" />
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Slide-style details card (replaces the inputs that used to live in Header) */}
        <ProjectDetailsCard client={client} setClient={setClient} />

        {/* Optional: keep your cover page */}
        <FrontPage client={client} setClient={setClient} />

        {/* Your product gallery (now pulling from Google Sheets via the function) */}
        <ProductGallery />

        {/* Your sections deck below, using the same client info */}
        <SectionsDeck
          client={client}
          setClient={setClient}
          sections={sections}
          setSections={setSections}
        />
      </main>
    </div>
  );
}
