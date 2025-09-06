import React, { useMemo, useState } from 'react';
import Header from './components/Header';
import SectionsDeck from './components/SectionsDeck';
import { Section } from './types';

export default function App() {
  // Your existing single-product view can remain if you want.
  // New: sectioned deck state
  const [sections, setSections] = useState<Section[]>([
    { id: crypto.randomUUID(), title: 'Bathroom 1' },
    { id: crypto.randomUUID(), title: 'Kitchen' },
    { id: crypto.randomUUID(), title: 'Laundry' },
  ]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* New multi-page deck */}
        <SectionsDeck sections={sections} setSections={setSections} />

        {/* (Optional) keep your old search/list/drawer area below or remove it if not needed */}
      </main>
    </div>
  );
}
