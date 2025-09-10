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

// ---- CONFIG: change this if your logo lives elsewhere ----
// If you put the file in /public/logo.png (recommended), leave as-is.
// If you have a remote URL, set it here (we'll proxy it safely).
const COVER_LOGO_URL = '/logo.png';

// Proxy helper for remote assets (keeps canvas untainted)
const viaProxy = (u?: string | null): string | undefined =>
  !u ? undefined : /^https?:\/\//i.test(u) ? `/api/pdf-proxy?url=${encodeURIComponent(u)}` : u;

// Simple HTML escaper for cover strings
function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// Wait for any <img> in a node to finish loading (so html2canvas captures it)
async function waitForImages(root: HTMLElement, timeoutMs = 8000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return;
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              const done = () => {
                img.removeEventListener('load', done);
                img.removeEventListener('error', done);
                resolve();
              };
              img.addEventListener('load', done);
              img.addEventListener('error', done);
              setTimeout(done, timeoutMs); // don’t hang forever
            })
    )
  );
}

export default function SectionsDeck({ client, sections, setSections }: Props) {
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
    setSections(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSection(id: string) {
    setSections(sections.filter((s) => s.id !== id));
    refs.current.delete(id);
  }

  const counts = useMemo(
    () =>
      Object.fromEntries(
        sections.map((s) => [s.id, s.products?.length ?? (s.product ? 1 : 0)])
      ),
    [sections]
  );

  /** Build an offscreen DOM for the cover, wait for logo, then snapshot */
  async function renderCoverCanvas(): Promise<HTMLCanvasElement> {
    const cover = document.createElement('div');
    cover.style.position = 'fixed';
    cover.style.left = '-10000px';
    cover.style.top = '-10000px';
    cover.style.width = '794px'; // A4 @ ~96dpi
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
      client?.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString();

    const totalProducts = sections.reduce(
      (n, s) => n + (s.products?.length ?? (s.product ? 1 : 0)),
      0
    );

    const logoSrc = viaProxy(COVER_LOGO_URL); // same-origin file stays same; remote is proxied
    const logoBox = logoSrc
      ? `<div style="display:flex;justify-content:center;align-items:center;border:1px solid #e5e7eb;border-radius:16px;height:200px">
           <img src="${logoSrc}" alt="Logo" style="max-width:420px;max-height:160px;object-fit:contain"/>
         </div>`
      : `<div style="border-radius:16px;border:1px dashed #e5e7eb;height:200px;display:flex;align-items:center;justify-content:center;color:#94a3b8">
           Your logo or image could go here
         </div>`;

    cover.innerHTML = `
      <div style="width:100%;max-width:720px;border:1px solid #e5e7eb;border-radius:16px;padding:48px;box-shadow:0 8px 20px rgba(0,0,0,0.06)">
        <div style="font-size:14px;color:#64748b;letter-spacing:.08em;text-transform:uppercase">Selection Deck</div>
        <h1 style="margin:8px 0 0;font-size:36px;line-height:1.15;color:#0f172a">${escapeHtml(projectName)}</h1>
        <div style="margin-top:12px;color:#334155">Prepared for <strong>${escapeHtml(clientName)}</strong></div>
        <div style="margin-top:2px;color:#64748b">${escapeHtml(dateText)}</div>

        <div style="margin-top:24px;height:1px;background:#e5e7eb;"></div>

        <div style="margin-top:24px;display:flex;gap:16px;flex-wrap:wrap;color:#475569">
          <div><strong>${sections.length}</strong> section${sections.length === 1 ? '' : 's'}</div>
          <div>·</div>
          <div><strong>${totalProducts}</strong> product${totalProducts === 1 ? '' : 's'}</div>
        </div>

        <div style="margin-top:32px">${logoBox}</div>

        <div style="margin-top:32px;color:#94a3b8;font-size:12px;text-align:center">
          Built with React + Tailwind · Exported from Pacific Bathroom Selection
        </div>
      </div>
    `;

    document.body.appendChild(cover);
    await waitForImages(cover, 8000); // ensure logo rendered
    const canvas = await html2canvas(cover, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    document.body.removeChild(cover);
    return canvas;
  }

  async function exportDeck() {
    const idsInOrder = sections.map((s) => s.id);
    if (idsInOrder.length === 0 && !includeCover) return;

    const pdf = new jsPDF('p', 'mm', 'a4');
    let firstPage = true;

    // 1) Cover
    if (includeCover) {
      const cover = await renderCoverCanvas();
      const img = cover.toDataURL('image/png');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (cover.height * imgW) / cover.width;
      const y = imgH > pageH ? 0 : (pageH - imgH) / 2;
      pdf.addImage(img, 'PNG', 0, y, imgW, imgH);
      firstPage = false;
    }

    // 2) Sections
    for (const id of idsInOrder) {
      const container = refs.current.get(id);
      if (!container) continue;

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{sections.length} section{sections.length === 1 ? '' : 's'}</span>
          <span>·</span>
          <span>
            {sections.reduce((n, s) => n + (s.products?.length ?? (s.product ? 1 : 0)), 0)} product
            {sections.reduce((n, s) => n + (s.products?.length ?? (s.product ? 1 : 0)), 0) === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeCover}
              onChange={(e) => setIncludeCover(e.target.checked)}
            />
            Include cover page
          </label>
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
            disabled={sections.length === 0 && !includeCover}
            className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm disabled:opacity-60"
            title="Export cover (optional) + all sections into one PDF"
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
