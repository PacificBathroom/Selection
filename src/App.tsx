import React, { useState } from 'react';
import Header from './components/Header';
import SectionsDeck from './components/SectionsDeck';
import FrontPage from './components/FrontPage';
import { Section, ClientInfo } from './types';

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
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <FrontPage client={client} setClient={setClient} />
        <SectionsDeck sections={sections} setSections={setSections} />
      </main>
    </div>
  );
}
