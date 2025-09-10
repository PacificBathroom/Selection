// src/components/SectionsDeck.tsx
import React from 'react';
import SectionSlide from './SectionSlide';
import type { Section, ClientInfo } from '../types';
import { exportDeckPptx } from '../utils/pptExporter';

type Props = {
  client: ClientInfo;
  setClient?: (next: ClientInfo) => void;
  sections: Section[];
  setSections: (next: Section[]) => void;
};

export default function SectionsDeck({ client, sections, setSections }: Props) {
  function addSection() {
    const n = sections.length + 1;
    const title = `Section ${n}`;
    const next: Section = { id: crypto.randomUUID(), title };
    setSections([...sections, next]);
  }

  function removeSection(id: string) {
    setSections(sections.filter((s) => s.id !== id));
  }

  function updateSection(id: string, next: Section) {
    setSections(sections.map((s) => (s.id === id ? next : s)));
  }

  async function handleExportPptx() {
    try {
      await exportDeckPptx({ client, sections });
    } catch (e) {
      console.error('Export PPTX failed', e);
      alert('Export failed. See console for details.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
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
            Add section
          </button>
          <button
            type="button"
            onClick={handleExportPptx}
            className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm"
          >
            Export PPTX
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {sections.map((section, idx) => (
          <div key={section.id} className="space-y-2">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => removeSection(section.id)}
                className="text-xs text-slate-600 hover:text-red-600 underline"
              >
                Remove section
              </button>
            </div>

            <SectionSlide
              section={section}
              onUpdate={(next) => updateSection(section.id, next)}
            />
          </div>
        ))}

        {sections.length === 0 && (
          <div className="text-sm text-slate-500">
            No sections yet. Click <em>Add section</em> to start.
          </div>
        )}
      </div>
    </div>
  );
}
