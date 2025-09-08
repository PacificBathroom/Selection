import React from 'react';
import { Section, ClientInfo } from '../types';
import SectionSlide from './SectionSlide';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import React, { useState } from 'react';
import SectionSlide from './SectionSlide';
import type { Section } from '../types';

const newSection = (title: string): Section => ({
  id: crypto.randomUUID(),
  title,
  product: null
});

export default function SectionsDeck() {
  const [sections, setSections] = useState<Section[]>([ newSection('Bathroom 1') ]);

  function updateSection(idx: number, next: Section) {
    setSections(s => s.map((sec, i) => (i === idx ? next : sec)));
  }
  function addSection() {
    const count = sections.length + 1;
    setSections(s => [...s, newSection(`Section ${count}`)]);
  }
  function removeSection(idx: number) {
    setSections(s => s.filter((_, i) => i !== idx));
  }
  function renameSection(idx: number, title: string) {
    setSections(s => s.map((sec, i) => (i === idx ? { ...sec, title } : sec)));
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <button onClick={addSection} className="rounded-lg bg-blue-600 text-white px-3 py-2">
          Add Section
        </button>
      </div>

      {sections.map((section, idx) => (
        <div key={section.id} className="rounded-2xl border p-4">
          <div className="flex justify-between items-center mb-3">
            <input
              value={section.title}
              onChange={(e) => renameSection(idx, e.target.value)}
              className="text-lg font-semibold border-b border-dashed bg-transparent focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Section {idx + 1}</span>
              <button onClick={() => removeSection(idx)} className="rounded border px-2 py-1 text-xs hover:bg-slate-50">
                Delete
              </button>
            </div>
          </div>

          <SectionSlide section={section} onUpdate={(next) => updateSection(idx, next)} index={idx} />
        </div>
      ))}
    </div>
  );
}

type Props = {
  sections: Section[];
  setSections: (s: Section[]) => void;
  client?: ClientInfo;
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

    const front = document.getElementById('slide-front');
    if (front) {
      const canvas = await html2canvas(front, { scale: 2, useCORS: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const imgData = canvas.toDataURL('image/png');
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(imgData, 'PNG', 0, 0, imgW, Math.min(imgH, pageH));
    }

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
      pdf.addImage(imgData, 'PNG', 0, 0, imgW, Math.min(imgH, pageH));
    }

    pdf.save('selection.pdf');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={addSection} className="rounded-lg bg-brand-600 text-white px-3 py-2 text-sm">Add Section</button>
        <button onClick={exportPDF} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">Export Deck (PDF)</button>
      </div>

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
