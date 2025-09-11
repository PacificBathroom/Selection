import React, { useState } from 'react';
import Header from './components/Header';
import SectionsDeck from './components/SectionsDeck';
import FrontPage from './components/FrontPage';
import { Section, ClientInfo } from './types';
import ProductGallery from "./components/ProductGallery";

export default function App() {
  return (
    <div>
      {/* your header / nav … */}
      <ProductGallery />
    </div>
  );
}


export default function App() {
  const [sections, setSections] = useState<Section[]>([
    { id: crypto.randomUUID(), title: 'Bathroom 1' },
    { id: crypto.randomUUID(), title: 'Kitchen' },
    { id: crypto.randomUUID(), title: 'Laundry' },
  ]);

  const [client, setClient] = useState<ClientInfo>({
    clientName: '',
    projectName: 'Project Selection',
    dateISO: undefined,
    // Optional contact fields used by Header + FrontPage
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  return (
    <div className="min-h-screen">
      <Header
        client={client}
        setClient={setClient}
        sectionsCount={sections.length}
      />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* You can keep FrontPage if you still want a cover page */}
        <FrontPage client={client} setClient={setClient} />
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
