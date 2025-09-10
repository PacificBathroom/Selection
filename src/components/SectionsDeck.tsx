// src/components/SectionsDeck.tsx
import React from 'react';
import type { ClientInfo, Section } from '../types';
import SectionSlide from './SectionSlide';
import { exportDeckPdf } from '../utils/deckExporter';

type Props = {
  client: ClientInfo;
  setClient: (v: ClientInfo) => void;
  sections: Section[];
  setSections: (v: Section[]) => void;
};

export default function SectionsDeck({ client, setClient, sections, setSections }: Props) {
  // ---- helpers ----
  function addSection() {
    const n = sections.length + 1;
    const next: Section = {
      id: crypto.randomUUID(),
      title: `Section ${n}`,
      products: [],
    };
    setSections([...sections, next]);
  }

  function removeSection(id: string) {
    setSections(sections.filter((s) => s.id !== id));
  }

  function moveSection(id: string, dir: -1 | 1) {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    const next = sections.slice();
    const [item] = next.splice(idx, 1);
    next.splice(j, 0, item);
    setSections(next);
  }

  function updateSection(next: Section) {
    setSections(sections.map((s) => (s.id === next.id ? next : s)));
  }

  const totalProducts = sections.reduce((acc, s) => acc + (s.products?.length || 0), 0);

  return (
    <section className="space-y-6">
      {/* Deck toolbar */}
      <div className="flex items-center justify-between bg-white border rounded-xl p-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold m-0">Sections</h2>
          <span className="text-xs text-slate-500">
            {sections.length} section{sections.length === 1 ? '' : 's'} • {totalProducts} product{totalProducts === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportDeckPdf({ client, sections })}
            className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm"
            title="Export whole deck (cover + one slide per product)"
          >
            Export Deck (PDF)
          </button>
          <button
            type="button"
            onClick={addSection}
            className="rounded-lg border border-slate-300 text-slate-700 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Add Section
          </button>
        </div>
      </div>

      {/* The sections */}
      <div className="space-y-8">
        {sections.map((s, i) => (
          <div key={s.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">Section {i + 1}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveSection(s.id, -1)}
                  disabled={i === 0}
                  className="rounded-lg border border-slate-300 text-slate-700 px-2 py-1 text-xs disabled:opacity-50"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(s.id, 1)}
                  disabled={i === sections.length - 1}
                  className="rounded-lg border border-slate-300 text-slate-700 px-2 py-1 text-xs disabled:opacity-50"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeSection(s.id)}
                  className="rounded-lg border border-rose-300 text-rose-700 px-2 py-1 text-xs hover:bg-rose-50"
                  title="Delete section"
                >
                  Remove
                </button>
              </div>
            </div>

            <SectionSlide section={s} onUpdate={updateSection} />
          </div>
        ))}

        {sections.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-10 bg-white border rounded-xl">
            No sections yet. Click <span className="font-medium">Add Section</span> to get started.
          </div>
        )}
      </div>
    </section>
  );
}
