import React, { useRef } from 'react';
import type { Product } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Props = {
  product?: Product;
  onClose: () => void;
};

export default function ProductDrawer({ product, onClose }: Props) {
  // Guard: nothing to render
  if (!product) return null;

  const slideRef = useRef<HTMLDivElement>(null);

  async function exportPDF() {
    const node = slideRef.current;
    if (!node) return;

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    pdf.addImage(img, 'PNG', 0, 0, imgW, imgH);
    pdf.save(`${product.code || product.name || 'product'}.pdf`);
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        {/* header */}
        <div className="p-6 border-b flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold leading-tight">{product.name}</h2>
            {product.code && <p className="text-sm text-slate-500">{product.code}</p>}
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

        {/* content to capture for PDF */}
        <div ref={slideRef} className="p-6">
          {/* hero + optional spec preview image */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              {product.image && (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full rounded-lg border"
                />
              )}
              {/* If you render a spec preview image elsewhere, you can place it here as a second <img> */}
            </div>

            <div className="prose max-w-none">
              {product.description && <p>{product.description}</p>}

              {!!(product.compliance?.length) && (
                <>
                  <h4>Compliance</h4>
                  <ul>
                    {product.compliance!.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </>
              )}

              {!!(product.features?.length) && (
                <>
                  <h4>Features</h4>
                  <ul>
                    {product.features!.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </>
              )}

              {!!(product.specs?.length) && (
                <>
                  <h4>Specifications</h4>
                  <table className="w-full text-sm">
                    <tbody>
                      {product.specs!.map((s, i) => (
                        <tr key={i}>
                          <td className="font-medium pr-3">{s.label}</td>
                          <td>{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {!!(product.assets?.length) && (
                <>
                  <h4>Downloads</h4>
                  <ul>
                    {product.assets!.map((a, i) => (
                      <li key={i}>
                        <a
                          className="text-brand-700 underline"
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {a.label || 'Document'}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* source link */}
          {product.sourceUrl && (
            <div className="mt-6 text-xs text-slate-500">
              Source:&nbsp;
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {product.sourceUrl}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
