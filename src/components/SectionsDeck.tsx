import React, { useState } from 'react';
import SectionSlide from './SectionSlide';
import type { Section } from '../types';

const makeSection = (title: string): Section => ({
  id: crypto.randomUUID(),
  title,
  // Use undefined (not null) to satisfy Section.product?: Product
  product: undefined,
});

export default function SectionsDeck() {
  const [sections, setSections] = useState<Section[]>([makeSection('Bathroom 1')]);

  function updateSection(idx: number, next: Section) {
    setSections((s) => s.map((sec, i) => (i === idx ? next : sec)));
  }

  function addSection() {
    const count = sections.length + 1;
    setSections((s) => [...s, makeSection(`Section ${count}`)]);
  }

  function removeSection(idx: number) {
    setSections((s) => s.filter((_, i) => i !== idx));
  }

  function renameSection(idx: number, title: string) {
    setSections((s) => s.map((sec, i) => (i === idx ? { ...sec, title } : sec)));
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
              <button
                onClick={() => removeSection(idx)}
                className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
              >
                Delete
              </button>
            </div>
          </div>

          <SectionSlide
            section={section}
            onUpdate={(next) => updateSection(idx, next)}
            index={idx}
          />
        </div>
      ))}
    </div>
  );
}
