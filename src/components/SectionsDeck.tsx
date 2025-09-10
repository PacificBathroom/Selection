// src/components/SectionsDeck.tsx
import React, { useMemo, useRef, useState } from 'react';
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
  // keep a ref per section to export only that DOM
  const refs = useRef<Map<string, HTMLDivElement>>(new Map());
  const setRef = (id: string) => (el: HTMLDivElement | null) => {
    if (!el) refs.current.delete(id);
    else refs.current.set(id, el);
  };

  const [includeCover, setIncludeCover] = useState(true);

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

  // product counts for headers
  const counts = useMemo(
    () =>
      Object.fromEntries(
        sections.map(s => [s.id, (s.products?.length ?? (s.product ? 1 : 0))])
      ),
    [sections]
  );

  /** Render a temporary offscreen cover page and return a canvas */
  async function renderCoverCanvas(): Promise<HTMLCanvasElement> {
    const cover = document.createElement('div');
    // A4-ish footprint for a nice capture (roughly 794x1123 @ 96dpi)
    cover.style.position = 'fixed';
    cover.style.left = '-10000px';
    cover.style.top = '-10000px';
    cover.style.width = '794px';
    cover.style.minHeight = '1123px';
    cover.style.boxSizing = 'border-box';
    cover.style.background = '#ffffff';
    cover.style.display = 'flex';
    cover.style.flexDirection = 'column';
    cover.style.justifyContent = 'center';
    cover.style.alignItems = 'center';
    cover.style.padding = '64px';

    const projectName = client?.projectName?.trim() || 'Project Selection';
    const clientName = client?.clientName?.trim() || 'Client name';
    const dateText =
      client?.dateISO
        ? new Date(client.dateISO).toLocaleDateString()
        : new Date().toLocaleDateString();

    // minimal inline styles so we don’t rely on Tailwind for the capture
    cover.innerHTML = `
      <div style="width:100%;max-width:720px;border:1px solid #e5e7eb;border-rad
