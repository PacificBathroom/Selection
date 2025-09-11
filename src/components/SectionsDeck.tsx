import React, { useMemo, useState } from 'react';
import type { ClientInfo, Section } from '../types';
import { exportDeckPptx } from '../utils/pptExporter';
import SectionSlide from './SectionSlide';

type Props = {
  client: ClientInfo;
  setClient: (next: ClientInfo) => void;
  sections: Section[];
  setSections: (next: Section[]) => void;
};

export default function SectionsDeck({ client, sections, setSections }: Props) {
  const [exporting, setExporting] = useState(false);

  const counts = useMemo(() => {
    const products = sections.reduce((n, s) => n + (s.products?.length || 0), 0);
    return { sections: sections.length, products };
  }, [sections]);

  function updateSection(id: string, next: Section) {
    setSections(sections.map((s) => (s.id === id ? next : s)));
  }

  async function onExport() {
    try {
      setExporting(true);
      await exportDeckPptx({ client, sections });
    } catch (e) {
      console.error(e);
      alert('Export failed. See console for details.');
    } finally {
      setExporting(false);
    }
  }

  function addSection() {
    setSections([
      ...sections,
      { id: crypto.randomUUID(), title: `Section ${sections.length + 1}`, products: [] },
    ]);
  }

  function removeSection(id: string) {
    setSections(sections.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          {counts.sections} section{counts.sections !== 1 ? 's' : ''} · {counts.products} product{counts.products !== 1 ? 's' : ''}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addSection}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Add section
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {exporting ? 'Exporting…' : 'Export PPTX'}
          </button>
        </div>
      </div>

      {sections.map((section, idx) => (
        <div key={section.id} className="rounded-xl border shadow-sm bg-white">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Section {idx + 1}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => removeSection(section.id)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              >
                Remove section
              </button>
            </div>
          </div>

          <div className="p-4">
            <import type { Section } from "../types"; // ensure this is imported at the top

<SectionSlide
  section={section}
  onUpdate={(next: Section) => {
    // your existing update logic, e.g.:
    setSections((prev) =>
      prev.map((s) => (s.id === next.id ? next : s))
    );
  }}
/>

          </div>
        </div>
      ))}
    </div>
  );
}
