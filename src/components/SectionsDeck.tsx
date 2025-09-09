// src/components/SectionsDeck.tsx
import React from 'react';
import SectionSlide from './SectionSlide';
import type { Section } from '../types';

type Props = {
  sections: Section[];
  setSections: React.Dispatch<React.SetStateAction<Section[]>>;
};

export default function SectionsDeck({ sections, setSections }: Props) {
  function updateSection(index: number, next: Section) {
    setSections(prev => {
      const copy = [...prev];
      copy[index] = next;
      return copy;
    });
  }

  function addSection() {
    const newSection: Section = {
      id: crypto.randomUUID(),
      title: `Section ${sections.length + 1}`,
      product: undefined,
    };
    setSections(prev => [...prev, newSection]);
  }

  function removeSection(index: number) {
    setSections(prev => prev.filter((_, i) => i !== index));
  }

  function renameSection(index: number, title: string) {
    setSections(prev => prev.map((s, i) => (i === index ? { ...s, title } : s)));
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <button
          onClick={addSection}
          className="rounded-lg bg-blue-600 text-white px-3 py-2"
        >
          ➕ Add Section
        </button>
      </div>

      {sections.map((section, i) => (
        <div key={section.id} className="rounded-2xl border p-4">
          <div className="flex justify-between items-center mb-3">
            <input
              value={section.title}
              onChange={(e) => renameSection(i, e.target.value)}
              className="text-lg font-semibold border-b border-dashed bg-transparent focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Section {i + 1}</span>
              <button
                onClick={() => removeSection(i)}
                className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
              >
                Delete
              </button>
            </div>
          </div>

          <SectionSlide
            section={section}
            onUpdate={(next) => updateSection(i, next)}
          />
        </div>
      ))}
    </div>
  );
}
