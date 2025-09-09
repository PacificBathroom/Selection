// src/components/ProductDrawer.tsx
import React, { useRef } from "react";
import type { Product, Asset } from "../types";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type Props = {
  product?: Product; // undefined when closed
  onClose: () => void;
};

export default function ProductDrawer({ product, onClose }: Props) {
  if (!product) return null;            // runtime + type guard
  const p: Product = product;           // ✅ non-null cache for TS

  // inside your component
const slideRef = useRef<HTMLDivElement>(null);

async function exportPDF() {
  const node = slideRef.current;
  if (!node) return;
  const canvas = await html2canvas(node, { scale: 2, useCORS: true });
  const img = canvas.toDataURL('image/png');

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  let y = 0;
  pdf.addImage(img, 'PNG', 0, y, imgW, imgH);
  pdf.save(`${p.code || p.name || 'product'}.pdf`);
}

return (
  <div ref={slideRef}>
    {/* your SectionSlide content here */}
  </div>
        <div className="p-6 border-b flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold leading-tight">{p.name}</h2>
            {p.code ? <p className="text-sm text-slate-500">{p.code}</p> : null}
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

        <div ref={contentRef} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="aspect-square rounded-lg border overflow-hidden bg-white flex items-center justify-center">
              {p.image ? (
                <img src={p.image} alt={p.name} className="h-full w-full object-contain" />
              ) : (
                <div className="text-slate-400 text-sm">No image</div>
              )}
            </div>

            {normalizedAssets.length > 0 ? (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Downloads</h4>
                <ul className="space-y-1">
                  {normalizedAssets.map((a, i) => {
                    const href = a.href ?? a.url;
                    return (
                      <li key={i}>
                        <a
                          href={href || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                        >
                          {a.label || href || "Download"}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            {p.brand ? (
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {p.brand}
              </div>
            ) : null}

            {p.description ? <p className="text-slate-700">{p.description}</p> : null}

            {p.features && p.features.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Features</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {p.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {p.specs && p.specs.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Specifications</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {p.specs.map((s, i) => (
                    <div key={i} className="flex justify-between gap-3">
                      <span className="text-slate-600">{s.label}</span>
                      <span className="font-medium">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {p.compliance && p.compliance.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Compliance</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {p.compliance.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {p.tags && p.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {p.tags.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-slate-600"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
