import React, { useRef } from 'react';
import type { Product } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Props = {
  product?: Product | null;
  onClose: () => void;
};

export default function ProductDrawer({ product, onClose }: Props) {
  // Hard guard so TS narrows `product` below
  if (!product) return null;
  const p: Product = product;

  const slideRef = useRef<HTMLDivElement>(null);

  async function exportPDF() {
    const node = slideRef.current;
    if (!node) return;
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 0, imgW, imgH);
    pdf.save(`${p.code || p.name || 'product'}.pdf`);
  }

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        <div className="p-6 border-b flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold leading-tight">{p.name}</h2>
            {p.code && <p className="text-sm text-slate-500">{p.code}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportPDF} className="rounded-lg bg-brand-600 text-white px-3 py-2 text-sm">Export PDF</button>
            <button onClick={onClose} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">Close</button>
          </div>
        </div>

        <div ref={slideRef} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              {p.image && <img src={p.image} alt={p.name} className="w-full rounded-lg border" />}
            </div>

            <div className="prose max-w-none">
              {p.description && <p>{p.description}</p>}

              {!!(p.compliance?.length) && (
                <>
                  <h4>Compliance</h4>
                  <ul>{p.compliance!.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </>
              )}

              {!!(p.features?.length) && (
                <>
                  <h4>Features</h4>
                  <ul>{p.features!.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </>
              )}

              {!!(p.specs?.length) && (
                <>
                  <h4>Specifications</h4>
                  <table className="w-full text-sm">
                    <tbody>
                      {p.specs!.map((s, i) => (
                        <tr key={i}>
                          <td className="font-medium pr-3">{s.label}</td>
                          <td>{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {!!(p.assets?.length) && (
                <>
                  <h4>Downloads</h4>
                  <ul>{p.assets!.map((a, i) => <li key={i}><a className="underline" href={a.url} target="_blank" rel="noreferrer">{a.label || 'Document'}</a></li>)}</ul>
                </>
              )}
            </div>
          </div>

          {p.sourceUrl && (
            <div className="mt-6 text-xs text-slate-500">
              Source:&nbsp;<a href={p.sourceUrl} target="_blank" rel="noreferrer" className="underline">{p.sourceUrl}</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
