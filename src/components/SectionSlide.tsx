import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Section, Product } from '../types';
import { renderPdfFirstPageToDataUrl } from '../utils/pdfPreview';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Props = { section: Section; onUpdate: (next: Section) => void };

// Small card for search results
function ResultCard({ r, onPick }: { r: { title: string; url: string; image?: string }, onPick: () => void }) {
  return (
    <button onClick={onPick} className="flex items-center gap-3 p-3 rounded-lg border w-full text-left hover:bg-slate-50">
      <div className="w-12 h-12 bg-slate-200 rounded overflow-hidden flex items-center justify-center">
        {r.image ? <img src={r.image} alt="" className="w-full h-full object-cover" /> : null}
      </div>
      <div className="text-sm">{r.title}</div>
    </button>
  );
}

export default function SectionSlide({ section, onUpdate }: Props) {
  const product = section.product;
  const slideRef = useRef<HTMLDivElement>(null);
  const [specImg, setSpecImg] = useState<string | null>(null);

  // ---------- PDF preview of spec sheet (safe) ----------
  useEffect(() => {
    setSpecImg(null);
    const url = product?.specPdfUrl;
    if (!url) return;

    let cancelled = false;
    renderPdfFirstPageToDataUrl(url, 1000)
     renderPdfFirstPageToDataUrl(pdfUrl).then((png: string) => {
  setPdfImage(png);
});      

  // ---------- Export THIS slide ----------
  async function exportThisSlide() {
    if (!slideRef.current) return;
    const canvas = await html2canvas(slideRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 0, imgW, imgH);
    pdf.save(`${product?.code || product?.name || section.title}.pdf`);
  }

  // ---------- Search workflow (when no product yet) ----------
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ title: string; url: string; image?: string }>>([]);

  async function search() {
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data?.results) ? data.results : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function importUrl(u: string) {
    const res = await fetch(`/api/scrape?url=${encodeURIComponent(u)}`);
    const data = await res.json();

    const p: Product = {
      id: data.code || data.id || crypto.randomUUID(),
      code: data.code,
      name: data.name || data.title || 'Imported Product',
      brand: data.brand,
      category: data.category,
      image: data.image,
      gallery: data.gallery,
      description: data.description,
      features: data.features,
      specs: data.specs,
      compliance: data.compliance,
      tags: data.tags,
      sourceUrl: u,
      specPdfUrl: data.specPdfUrl,      // <— from scraper
      assets: data.assets,               // optional
    };

    onUpdate({ ...section, product: p });
  }

  // ---------- RENDER ----------
  if (!product) {
    // SEARCH MODE
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Precero products (e.g. 'la casa 2 in 1')"
            className="flex-1 rounded-lg border px-3 py-2"
          />
          <button onClick={search} className="rounded-lg bg-brand-600 text-white px-3 py-2 text-sm">
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {results.length === 0 && !searching && (
          <div className="text-sm text-slate-500">Type a query and click Search to populate this page.</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((r, i) => (
            <ResultCard key={i} r={r} onPick={() => importUrl(r.url)} />
          ))}
        </div>
      </div>
    );
  }

  // SLIDE MODE (product is defined)
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={exportThisSlide} className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm">
          Export PDF
        </button>
      </div>

      <div ref={slideRef} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 rounded-xl shadow-sm">
        <div>
          {product.image && <img src={product.image} alt={product.name} className="w-full rounded-lg border" />}
          {specImg && <img src={specImg} alt="Specifications preview" className="w-full mt-4 rounded-lg border" />}
        </div>

        <div className="prose max-w-none">
          <h3 className="m-0">{product.name}</h3>
          {product.code && <p className="text-sm text-slate-500 m-0">{product.code}</p>}
          {product.description && <p>{product.description}</p>}

          {!!(product.compliance?.length) && (
            <>
              <h4>Compliance</h4>
              <ul>{product.compliance!.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </>
          )}

          {!!(product.features?.length) && (
            <>
              <h4>Features</h4>
              <ul>{product.features!.map((f, i) => <li key={i}>{f}</li>)}</ul>
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
        </div>
      </div>
    </div>
  );
}
