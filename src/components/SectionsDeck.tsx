import React from 'react';
import { Section } from '../types';
import SectionSlide from './SectionSlide';

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

  return (
    <div className="space-y-6">
      {sections.map((section, i) => (
        <div key={section.id} className="relative border rounded-xl shadow-sm">
          <button
            onClick={() => removeSection(i)}
            className="absolute top-2 right-2 text-xs text-red-600 hover:underline"
          >
            Remove
          </button>

          <SectionSlide
            section={section}
            onUpdate={next => updateSection(i, next)}
          />
        </div>
      ))}

      <div className="pt-4">
        <button
          onClick={addSection}
          className="rounded-lg bg-brand-600 text-white px-4 py-2 shadow hover:opacity-90"
        >
          ➕ Add Section
        </button>
      </div>
    </div>
  );
}
