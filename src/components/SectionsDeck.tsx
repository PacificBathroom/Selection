import React from 'react';
import { Section } from '../types';
import SectionSlide from './SectionSlide';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Props = {
  sections: Section[];
  setSections: (s: Section[]) => void;
};

export default function SectionsDeck({ sections, setSections }: Props) {
  function updateSection(next: Section) {
    setSections(sections.map(s => (s.id === next.id ? next : s)));
  }
  function addSection() {
    setSections([...sections, { id: crypto.randomUUID(), title: `New Section ${sections.length + 1}` }]);
  }
  function removeSection(id: string) {
    setSections(sections.filter(s => s.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    const copy = sections.slice();
    const [item] = copy.splice(idx, 1);
    copy.splice(j, 0, item);
    setSections(copy);
  }

  async function exportPDF() {
    const pdf = new jsPDF('p', 'mm', 'a4');
    let first = true;

    for (const s of sections) {
      const el = document.getElementById(`slide-${s.id}`);
      if (!el) continue;

      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const imgData = canvas.toDataURL('image/png');

      if (!first) pdf.addPage();
      first = false;

      if (imgH <= pageH) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
      } else {
        // naive pagination if the slide is taller than A4
        let remaining = imgH;
        while (remaining > 0) {
          pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
          remaining -= pageH;
          if (remaining > 0) pdf.addPage();
        }
      }
    }

    pdf.save('selection.pdf');
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button onClick={addSection} className="rounded-lg bg-brand-600 text-white px-3 py-2 text-sm">Add Section</button>
        <button onClick={exportPDF} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">Export Deck (PDF)</button>
      </div>

      {/* Slides */}
      <div className="space-y-6">
        {sections.map((s, i) => (
          <div key={s.id} className="relative">
            <div className="absolute right-2 -top-3 flex gap-2">
              <button onClick={() => move(s.id, -1)} className="rounded-full border w-8 h-8 text-sm">↑</button>
              <button onClick={() => move(s.id, 1)} className="rounded-full border w-8 h-8 text-sm">↓</button>
              <button onClick={() => removeSection(s.id)} className="rounded-full border w-8 h-8 text-sm">✕</button>
            </div>
            <SectionSlide section={s} onUpdate={updateSection} index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}
