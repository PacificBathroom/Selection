import React, { useRef } from 'react';
import type { Section, ClientInfo } from '../types';
import SectionSlide from './SectionSlide';
import FrontPage from './FrontPage';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Props = {
  client: ClientInfo;
  setClient: (c: ClientInfo) => void;
  sections: Section[];
  setSections: React.Dispatch<React.SetStateAction<Section[]>>;
};

export default function SectionsDeck({ client, setClient, sections, setSections }: Props) {
  const framesRef = useRef<Array<HTMLDivElement | null>>([]);
  const frontRef = useRef<HTMLDivElement | null>(null);

  async function exportDeckPdf() {
    const pdf = new jsPDF('p', 'mm', 'a4');
    let first = true;

    // --- FRONT PAGE ---
    if (frontRef.current) {
      const canvas = await html2canvas(frontRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const img = canvas.toDataURL('image/png');
      const pageW = pdf.internal.pageSize.getWidth();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      pdf.addImage(img, 'PNG', 0, 0, imgW, imgH);
      first = false;
    }

    // --- EACH SECTION ---
    for (const node of framesRef.current) {
      if (!node) continue;
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const img = canvas.toDataURL('image/png');
      const pageW = pdf.internal.pageSize.getWidth();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      if (!first) pdf.addPage();
      pdf.addImage(img, 'PNG', 0, 0, imgW, imgH);
      first = false;
    }

    pdf.save('selection-deck.pdf');
  }

  function addSection() {
    setSections((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: `Section ${prev.length + 1}`, product: undefined },
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={addSection} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50">
          Add Section
        </button>
        <button onClick={exportDeckPdf} className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm">
          Export Deck (PDF)
        </button>
      </div>

      {/* --- FRONT PAGE --- */}
      <div ref={frontRef}>
        <FrontPage client={client} setClient={setClient} />
      </div>

      {/* --- PRODUCT SECTIONS --- */}
      {sections.map((section, idx) => (
        <div
          key={section.id}
          ref={(el) => (framesRef.current[idx] = el)}
          className="bg-white p-4 rounded-xl"
        >
          <SectionSlide
            section={section}
            onUpdate={(next) =>
              setSections((prev) => prev.map((s) => (s.id === next.id ? next : s)))
            }
          />
        </div>
      ))}
    </div>
  );
}
