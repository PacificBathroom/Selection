// src/components/SectionsDeck.tsx
import React from 'react';
import SectionSlide from './SectionSlide';
import type { ClientInfo, Section } from '../types';

type Props = {
  client: ClientInfo;
  setClient: (c: ClientInfo) => void;
  sections: Section[];
  setSections: (s: Section[]) => void;
};

export default function SectionsDeck({ client, setClient, sections, setSections }: Props) {
  function addSection() {
    const nextIndex = sections.length + 1;
    const newSection: Section = {
      id: crypto.randomUUID(),
      title: `Section ${nextIndex}`,
      // product: null, // include if your Section type has it
    };
    setSections([...sections, newSection]);
  }

  function updateSection(idx: number, next: Section) {
    const copy = sections.slice();
    copy[idx] = next;
    setSections(copy);
  }

  function removeSection(idx: number) {
    const copy = sections.slice();
    copy.splice(idx, 1);
    setSections(copy);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-500">
          {sections.length} {sections.length === 1 ? 'section' : 'sections'}
        </div>
        <button onClick={addSection} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50">
          Add Section
        </button>
      </div>

      {sections.map((section, i) => (
        <div key={section.id} className="bg-white rounded-xl border shadow-sm p-4">
          <SectionSlide
            section={section}
            onUpdate={(next) => updateSection(i, next)}
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => removeSection(i)}
              className="text-xs text-slate-500 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
