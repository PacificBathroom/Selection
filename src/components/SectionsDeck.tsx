import React, { useState } from 'react';
import { Section } from '../types';

// This is a tiny placeholder so TS can build if your full version isn’t committed yet.
export default function SectionsDeck({ sections, setSections }:
  { sections: Section[]; setSections: (s: Section[]) => void }) {

  function addSection() {
    setSections([...sections, { id: crypto.randomUUID(), title: `New Section ${sections.length + 1}` }]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={addSection} className="rounded-lg bg-brand-600 text-white px-3 py-2 text-sm">Add Section</button>
      </div>
      <div className="space-y-3">
        {sections.map((s, i) => (
          <div key={s.id} className="rounded border p-4 bg-white">
            <input
              value={s.title}
              onChange={e => setSections(sections.map(x => x.id === s.id ? { ...x, title: e.target.value } : x))}
              className="text-lg font-semibold border-b border-dashed focus:outline-none"
            />
            <div className="text-sm text-slate-500 mt-2">Section {i + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
