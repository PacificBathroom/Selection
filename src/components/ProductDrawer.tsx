import React, { useRef } from 'react';
import type { Product, Asset } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Props = {
  product?: Product;                 // undefined when closed
  onClose: () => void;
};

export default function ProductDrawer({ product, onClose }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  if (!product) return null;

  async function exportPDF() {
    const node = contentRef.current;
    if (!node) return;
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
      // basic pagination for tall content
      let y = 0;
      let remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 0, 0 - y, imgW, imgH);
        remaining -= pageH;
        y += pageH;
        if (remaining > 0) pdf.addPage();
      }
    }

    const fname = (product.code || product.name || 'product').replace(/\s+/g, '_');
    pdf.save(`${fname}.pdf`);
  }

  // normalize assets so either .href or .url works
  const assets: Asset[] = Array.isArray(product.assets) ? product.assets : [];
  const normalizedAssets = assets.map((a) => ({
    label: a.label,
    href: a.href ?? a.url,     // prefer href, fall back to url
    url: a.url ?? a.href,
  }));

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto"
        aria-modal="true"
        role="dialog"
      >
        {/* Header */}
        <div className="p-6 border-b flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold leading-tight">{product.name}</h2>
            {product.code && <p className="text-sm text-slate-500">{product.code}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPDF}
              className="rounded-lg bg-blue-600 text-white px-3 py-2 text-sm shadow hover:opacity-90"
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

        {/* Content */}
        <div ref={contentRef} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: image + downloads */}
          <div>
            <div className="aspect-square rounded-lg border overflow-hidden bg-white flex items-center justify-center">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-slate-400 text-sm">No image</div>
              )}
            </div>

            {normalizedAssets.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Downloads</h4>
                <ul className="space-y-1">
                  {normalizedAssets.map((a, i) => (
                    <li key={i}>
                      <a
                        href={(a.href ?? a.url) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        {a.label || a.href || a.url || 'Download'}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right: details */}
          <div className="space-y-3">
            {product.brand && (
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {product.brand}
              </div>
            )}

            {product.description && (
              <p className="text-slate-700">{product.description}</p>
            )}

            {product.features?.length ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Features</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {product.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {product.specs?.length ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Specifications</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {product.specs.map((s, i) => (
                    <div key={i} className="flex justify-between gap-3">
                      <span className="text-slate-600">{s.label}</span>
                      <span className="font-medium">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {product.compliance?.length ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Compliance</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {product.compliance.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {product.tags?.length ? (
              <div className="flex flex-wrap gap-2">
                {product.tags.map((t, i) => (
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
