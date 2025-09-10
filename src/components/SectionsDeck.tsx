// src/components/SectionsDeck.tsx
import React, { useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SectionSlide from './SectionSlide';
import type { ClientInfo, Section } from '../types';

type Props = {
  client: ClientInfo;
  setClient: (next: ClientInfo) => void;
  sections: Section[];
  setSections: (next: Section[]) => void;
};

export default function SectionsDeck({ client, sections, setSections }: Props) {
  // keep a ref per section to export only the visible DOM
  const refs = useRef<Map<string, HTMLDivElement>>(new Map());
  const setRef = (id: string) => (el: HTMLDivElement | null) => {
    if (!el) refs.current.delete(id);
    else refs.current.set(id, el);
  };

  function addSection() {
    const n = sections.length + 1;
    const next: Section = { id: crypto.randomUUID(), title: `Section ${n}`, products: [] };
    setSections([...sections, next]);
  }

  function updateSection(id: string, patch: Partial<Section>) {
    setSections(sections.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSection(id: string) {
    setSections(sections.filter(s => s.id !== id));
    refs.current.delete(id);
  }

  // small helper to get product counts
  const counts = useMemo(
    () =>
      Object.fromEntries(
        sections.map(s => [s.id, (s.products?.length ?? (s.product ? 1 : 0))])
      ),
    [sections]
  );

  async function exportDeck() {
    const idsInOrder = sections.map(s => s.id);
    if (idsInOrder.length === 0) return;

    const pdf = new jsPDF('p', 'mm', 'a4');
    let firstPage = true;

    for (const id of idsInOrder) {
      const container = refs.current.get(id);
      if (!container) continue;

      // render section to canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      // add to PDF (auto-split if tall)
      const img = canvas.toDataURL('image/png');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      let heightLeft = imgH;
      let position = 0;

      if (!firstPage) pdf.addPage();
      firstPage = false;

      pdf.addImage(img, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;

      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(img, 'PNG', 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
    }

    const name = client?.projectName?.trim() || 'selection-deck';
    pdf.save(`${name}.pdf`);
  }

  return (
    <section className="space-y-6">
      {/* Deck toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          {sections.length} section{sections.length === 1 ? '' : 's'}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addSection}
            className="rounded-lg border border-slate-300 text-slate-700 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Add Section
          </button>
          <button
            type="button"
            onClick={exportDeck}
            disabled={sections.length === 0}
            className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm disabled:opacity-60"
            title="Export all sections into one PDF"
          >
            Export Deck (PDF)
          </button>
        </div>
      </div>

      {/* Sections */}
      {sections.map((s, idx) => (
        <div key={s.id} className="rounded-xl border shadow-sm bg-white/40">
          <div className="flex items-center justify-between px-4 pt-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Section {idx + 1} · {counts[s.id] ?? 0} product{(counts[s.id] ?? 0) === 1 ? '' : 's'}
            </div>
            <button
              type="button"
              onClick={() => removeSection(s.id)}
              className="text-xs text-slate-600 hover:text-red-600 underline"
            >
              Remove section
            </button>
          </div>

          {/* The content we snapshot for PDF */}
          <div ref={setRef(s.id)} className="p-4">
            <SectionSlide section={s} onUpdate={(next) => updateSection(s.id, next)} />
          </div>
        </div>
      ))}
    </section>
  );
}
