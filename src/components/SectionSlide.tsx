import React, { useEffect, useRef, useState } from 'react';
import type { Section } from '../types';
import { renderPdfFirstPageToDataUrl } from '../utils/pdfPreview';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Props = { section: Section; onUpdate: (next: Section) => void };

export default function SectionSlide({ section }: Props) {
  const p = section.product;
  const slideRef = useRef<HTMLDivElement>(null);
  const [specImg, setSpecImg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSpecImg(null);
    const url = p?.specPdfUrl;
    if (!url) return;

    renderPdfFirstPageToDataUrl(url, 1000)
      .then((png) => !cancelled && setSpecImg(png))
      .catch(() => !cancelled && setSpecImg(null));

    return () => { cancelled = true; };
  }, [p?.specPdfUrl]);

  if (!p) return null;

  async function exportThisSlide() {
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
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={exportThisSlide} className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm">
          Export PDF
        </button>
      </div>

      <div ref={slideRef} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 rounded-xl shadow-sm">
        {/* Left column: images */}
        <div>
          {p.image && <img src={p.image} alt={p.name} className="w-full rounded-lg border" />}
          {specImg && (
            <img src={specImg} alt="Specifications preview" className="w-full mt-4 rounded-lg border" />
          )}
        </div>

        {/* Right column: details */}
        <div className="prose max-w-none">
          <h3 className="m-0">{p.name}</h3>
          {p.code && <p className="text-sm text-slate-500 m-0">{p.code}</p>}
          {p.description && <p>{p.description}</p>}

          {!!(p.compliance?.length) && (
            <>
              <h4>Compliance</h4>
              <ul>{p.compliance.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </>
          )}

          {!!(p.features?.length) && (
            <>
              <h4>Features</h4>
              <ul>{p.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </>
          )}

          {!!(p.specs?.length) && (
            <>
              <h4>Specifications</h4>
              <table className="w-full text-sm">
                <tbody>
                  {p.specs.map((s, i) => (
                    <tr key={i}>
                      <td className="font-medium pr-3">{s.label}</td>
                      <td>{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
