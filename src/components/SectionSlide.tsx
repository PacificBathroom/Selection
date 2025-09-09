import React, { useEffect, useState } from 'react';
import type { Section } from '../types';
import { renderPdfFirstPageToDataUrl } from '../utils/pdfPreview';

type Props = { section: Section; onUpdate: (next: Section) => void };

export default function SectionSlide({ section }: Props) {
  const p = section.product;
  const [specImg, setSpecImg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSpecImg(null);

    const url = p?.specPdfUrl;
    if (!url) return;

    renderPdfFirstPageToDataUrl(url, 1000)
      .then((dataUrl) => { if (!cancelled) setSpecImg(dataUrl); })
      .catch(() => { if (!cancelled) setSpecImg(null); });

    return () => { cancelled = true; };
  }, [p?.specPdfUrl]);

  if (!p) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left column: product hero */}
      <div>
        {p.image && <img src={p.image} alt={p.name} className="w-full rounded-lg border" />}
        {specImg && (
          <img
            src={specImg}
            alt="Specifications preview"
            className="w-full mt-4 rounded-lg border"
          />
        )}
      </div>

      {/* Right column: details */}
      <div className="prose max-w-none">
        <h3 className="m-0">{p.name}</h3>
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
  );
}
