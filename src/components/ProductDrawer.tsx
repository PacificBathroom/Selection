// src/components/ProductDrawer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Product } from '../types';
import Tag from './Tag';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import logo from '../assets/logo.png';

type Props = {
  product: Product | null;
  onClose: () => void;
};

export default function ProductDrawer({ product, onClose }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Header details (editable in Header.tsx; read here for PDF header)
  const [projectName, setProjectName] = useState<string>('Pacific Bathroom Project');
  const [contactName, setContactName] = useState<string>('Your Name');
  const [contactEmail, setContactEmail] = useState<string>('you@example.com');
  const [contactPhone, setContactPhone] = useState<string>('0000 000 000');
  const [jobDate, setJobDate] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  });

  useEffect(() => {
    const pn = localStorage.getItem('projectName');
    const cn = localStorage.getItem('contactName');
    const ce = localStorage.getItem('contactEmail');
    const cp = localStorage.getItem('contactPhone');
    const jd = sessionStorage.getItem('jobDate');
    if (pn) setProjectName(pn);
    if (cn) setContactName(cn);
    if (ce) setContactEmail(ce);
    if (cp) setContactPhone(cp);
    if (jd) setJobDate(jd);
  }, []);

  // Guard and non-null local for strict TS
  if (!product) return null;
  const p: Product = product;

  async function exportPDF() {
    const node = contentRef.current!;
    const canvas = await html2canvas(node, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
    } else {
      let remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
        remaining -= pageH;
        if (remaining > 0) pdf.addPage();
      }
    }
    pdf.save(`${p.code || p.id}.pdf`);
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        {/* Header row */}
        <div className="p-6 border-b flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold leading-tight">{p.name}</h2>
            <p className="text-sm text-slate-500">{p.code}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPDF}
              className="rounded-lg bg-brand-600 text-white px-3 py-2 text-sm shadow hover:opacity-90"
            >
              Export PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        {/* Exportable content */}
        <div ref={contentRef} className="p-6 grid grid-cols-1 gap-6">
          {/* Brand strip */}
          <div className="flex items-center justify-between border rounded-xl p-4 bg-slate-50">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Pacific Bathroom" className="h-10 w-auto" />
              <div className="leading-tight text-sm">
                <div className="font-semibold">{projectName}</div>
                <div className="text-slate-600">Contact: {contactName}</div>
                <div className="text-slate-600">Email: {contactEmail}</div>
                <div className="text-slate-600">Phone: {contactPhone}</div>
              </div>
            </div>
            <div className="text-right">
              {jobDate && <div className="text-xs text-slate-600">Date: {jobDate}</div>}
              {p.price && <div className="font-semibold mt-1">{p.price}</div>}
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: images */}
            <div className="space-y-4">
              <div className="aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-slate-400">
                    No image
                  </div>
                )}
              </div>

              {(p.gallery ?? []).length > 0 && (
                <div className="grid grid-cols-4 gap-3">
                  {(p.gallery ?? []).map((g: string, i: number) => (
                    <img key={i} src={g} className="h-20 w-full object-cover rounded-lg" />
                  ))}
                </div>
              )}
            </div>

            {/* Right: details */}
            <div className="space-y-6">
              {p.description && (
                <div>
                  <h3 className="font-semibold mb-2">Overview</h3>
                  <p className="text-slate-700">{p.description}</p>
                </div>
              )}

              {(p.features ?? []).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Key Features</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 text-sm">
                    {(p.features ?? []).map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(p.specs ?? []).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Technical Specifications</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {(p.specs ?? []).map(
                      (s: { label: string; value: string }, i: number) => (
                        <div key={i} className="flex justify-between border-b py-1">
                          <span className="text-slate-500">{s.label}</span>
                          <span className="font-medium">{s.value}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {(p.compliance ?? []).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Compliance & Ratings</h3>
                  <div className="flex flex-wrap gap-2">
                    {(p.compliance ?? []).map((c: string, i: number) => (
                      <Tag key={i}>{c}</Tag>
                    ))}
                  </div>
                </div>
              )}

              {(p.assets ?? []).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Resources & Downloads</h3>
                  <div className="flex flex-wrap gap-2">
                    {(p.assets ?? []).map((a: { label: string; url: string }, i: number) => (
                      <a
                        key={i}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        {a.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {p.sourceUrl && (
                <p className="text-xs text-slate-500">
                  Imported from{' '}
                  <a className="underline" href={p.sourceUrl} target="_blank" rel="noreferrer">
                    {p.sourceUrl}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
        {/* end exportable content */}
      </div>
    </div>
  );
}
