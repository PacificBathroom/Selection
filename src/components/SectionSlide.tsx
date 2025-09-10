// src/components/SectionSlide.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Section, Product } from '../types';
import { renderPdfFirstPageToDataUrl } from '../utils/pdfPreview';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Props = { section: Section; onUpdate: (next: Section) => void };

// Route external assets (images/PDFs) through Netlify proxy to avoid CORS/tainted canvas
const viaProxy = (u?: string | null): string | undefined =>
  u ? `/api/pdf-proxy?url=${encodeURIComponent(u)}` : undefined;

// Small card for search results
function ResultCard({
  r,
  onPick,
}: {
  r: { title: string; url: string; image?: string };
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex items-center gap-3 p-3 rounded-lg border w-full text-left hover:bg-slate-50"
    >
      <div className="w-12 h-12 bg-slate-200 rounded overflow-hidden flex items-center justify-center">
        {r.image ? <img src={r.image} alt="" className="w-full h-full object-cover" /> : null}
      </div>
      <div className="text-sm leading-snug">
        <div className="font-medium">{r.title}</div>
        <div className="text-xs text-slate-500 break-all">{r.url}</div>
      </div>
    </button>
  );
}

/** Inline editable heading used by each section */
function EditableHeading({
  title,
  onChange,
}: {
  title: string;
  onChange: (t: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  useEffect(() => setValue(title), [title]);

  function commit() {
    const v = (value || '').trim() || 'Untitled Section';
    onChange(v);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setValue(title);
              setEditing(false);
            }
          }}
          className="text-lg font-semibold text-gray-800 border rounded px-2 py-1 w-full max-w-md"
          aria-label="Section title"
        />
      ) : (
        <h2
          className="text-lg font-semibold text-gray-800 cursor-text"
          onDoubleClick={() => setEditing(true)}
          title="Double-click to rename section"
        >
          {title}
        </h2>
      )}

      {!editing && (
        <button
          type="button"
          className="text-xs text-slate-600 hover:text-blue-600 underline"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
      )}
    </div>
  );
}

export default function SectionSlide({ section, onUpdate }: Props) {
  const product = section.product as Product | undefined;
  const slideRef = useRef<HTMLDivElement>(null);

  const [specImg, setSpecImg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ---------- PDF preview of spec sheet ----------
  useEffect(() => {
    setSpecImg(null);
    const url = product?.specPdfUrl;
    if (!url) return;

    let cancelled = false;
    (async () => {
      try {
        const proxied = viaProxy(url)!;
        const png = await renderPdfFirstPageToDataUrl(proxied, 1000);
        if (!cancelled) setSpecImg(png);
      } catch (e) {
        console.error('Failed to render PDF preview', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [product?.specPdfUrl]);

  // ---------- Export THIS slide ----------
  async function exportThisSlide() {
    if (!slideRef.current) return;
    try {
      const canvas = await html2canvas(slideRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const y = imgH > pageH ? 0 : (pageH - imgH) / 2; // center if shorter
      pdf.addImage(img, 'PNG', 0, y, imgW, imgH);
      pdf.save(`${product?.code || product?.name || section.title || 'selection'}.pdf`);
    } catch (err: any) {
      console.error('export error', err);
      setErrorMsg(
        'Could not export this slide. If you see a "tainted canvas" error in the console, make sure every image/PDF is loaded via the proxy.'
      );
    }
  }

  // ---------- Search workflow (when no product yet) ----------
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ title: string; url: string; image?: string }>>([]);

  async function search() {
    const term = q.trim();
    if (!term) return;
    setErrorMsg(null);
    setSearching(true);
    setResults([]);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Search failed (${res.status}). ${txt.slice(0, 200)}`);
      }

      const data = await res.json().catch(() => ({}));

      // Accept several common shapes: [], {results:[]}, {items:[]}, {data:[]}
      const list =
        Array.isArray(data) ? data :
        Array.isArray((data as any)?.results) ? (data as any).results :
        Array.isArray((data as any)?.items) ? (data as any).items :
        Array.isArray((data as any)?.data) ? (data as any).data : [];

      // Normalize to {title,url,image?}
      const normalized = list
        .map((r: any) => ({
          title: r.title ?? r.name ?? r.text ?? 'Untitled',
          url: r.url ?? r.link ?? r.href ?? '',
          image: r.image ?? r.thumbnail ?? r.img ?? undefined,
        }))
        .filter((r: any) => typeof r.url === 'string' && r.url.length > 0);

      setResults(normalized);
      if (normalized.length === 0) {
        setErrorMsg('No results found for that query.');
      }
    } catch (e: any) {
      console.error('search error', e);
      setErrorMsg(e?.message || 'Search failed. Check the Netlify function logs.');
    } finally {
      setSearching(false);
    }
  }

  async function importUrl(u: string) {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(u)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Import failed (${res.status}). ${txt.slice(0, 200)}`);
      }

      const data = await res.json().catch(() => ({} as any));

      const p: Product = {
        id: data.code || data.id || crypto.randomUUID(),
        code: data.code ?? undefined,
        name: data.name || data.title || 'Imported Product',
        brand: data.brand ?? undefined,
        category: data.category ?? undefined,
        image: data.image ?? undefined,
        gallery: Array.isArray(data.gallery) ? data.gallery : undefined,
        description: data.description ?? undefined,
        features: Array.isArray(data.features) ? data.features : undefined,
        specs: Array.isArray(data.specs) ? data.specs : undefined,
        compliance: Array.isArray(data.compliance) ? data.compliance : undefined,
        tags: Array.isArray(data.tags) ? data.tags : undefined,
        sourceUrl: u,
        specPdfUrl: data.specPdfUrl ?? undefined,
        assets: Array.isArray(data.assets) ? data.assets : undefined,
      };

      onUpdate({ ...section, product: p });
    } catch (e: any) {
      console.error('import error', e);
      setErrorMsg(e?.message || 'Failed to import product details.');
    }
  }

  // ---------- helpers for specs rendering ----------
  const hasTableLikeSpecs = useMemo(() => {
    const s = product?.specs;
    if (!Array.isArray(s) || s.length === 0) return false;
    const first = s[0] as any;
    return typeof first === 'object' && first && ('label' in first || 'value' in first);
  }, [product?.specs]);

  // ---------- RENDER ----------
  if (!product) {
    // SEARCH MODE
    return (
      <div className="space-y-4">
        {/* Editable section heading */}
        <EditableHeading
          title={section.title || 'Untitled Section'}
          onChange={(t) => onUpdate({ ...section, title: t })}
        />

        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Precero products (e.g. 'la casa 2 in 1')"
            className="flex-1 rounded-lg border px-3 py-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') search();
            }}
            aria-label="Search products"
          />
          <button
            type="button"
            onClick={search}
            disabled={searching}
            className="rounded-lg bg-brand-600 text-white px-3 py-2 text-sm disabled:opacity-60"
            aria-busy={searching}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {errorMsg && (
          <div className="text-sm text-red-600" role="alert">
            {errorMsg}
          </div>
        )}

        {results.length === 0 && !searching && !errorMsg && (
          <div className="text-sm text-slate-500">
            Type a query and click Search to populate this page.
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((r, i) => (
              <ResultCard key={`${r.url}-${i}`} r={r} onPick={() => importUrl(r.url)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // SLIDE MODE (product is defined)
  return (
    <div className="space-y-3">
      {/* Editable heading + Export button in one row */}
      <div className="flex items-center justify-between">
        <EditableHeading
          title={section.title || 'Untitled Section'}
          onChange={(t) => onUpdate({ ...section, title: t })}
        />
        <button
          type="button"
          onClick={exportThisSlide}
          className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm"
        >
          Export PDF
        </button>
      </div>

      {errorMsg && (
        <div className="text-sm text-red-600" role="alert">
          {errorMsg}
        </div>
      )}

      <div
        ref={slideRef}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 rounded-xl shadow-sm border"
      >
        <div>
          {product.image && (
            <img
              src={viaProxy(product.image)}
              alt={product.name ?? 'Product image'}
              className="w-full rounded-lg border"
            />
          )}

          {specImg && (
            <img
              src={specImg}
              alt="Specifications preview"
              className="w-full mt-4 rounded-lg border bg-white"
            />
          )}
        </div>

        <div className="prose max-w-none">
          <h3 className="m-0">{product.name ?? 'Selected product'}</h3>
          {product.code && <p className="text-sm text-slate-500 m-0">{product.code}</p>}
          {product.sourceUrl && (
            <p className="m-0">
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 break-all"
              >
                {product.sourceUrl}
              </a>
            </p>
          )}
          {product.description && <p>{product.description}</p>}

          {!!product.compliance?.length && (
            <>
              <h4>Compliance</h4>
              <ul>
                {product.compliance!.map((c: string, i: number) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          )}

          {!!product.features?.length && (
            <>
              <h4>Features</h4>
              <ul>
                {product.features!.map((f: string, i: number) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </>
          )}

          {!!product.specs?.length && (
            <>
              <h4>Specifications</h4>
              {hasTableLikeSpecs ? (
                <table className="w-full text-sm">
                  <tbody>
                    {(product.specs as any[]).map((s: any, i: number) => (
                      <tr key={i}>
                        <td className="font-medium pr-3 align-top">{s.label ?? ''}</td>
                        <td className="align-top">{s.value ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <ul>
                  {(product.specs as any[]).map((s: any, i: number) => (
                    <li key={i}>{String(s)}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
