// src/components/SectionSlide.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Section, Product } from '../types';
import { renderPdfFirstPageToDataUrl } from '../utils/pdfPreview';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Props = { section: Section; onUpdate: (next: Section) => void };

/** Route external assets (images/PDFs) through the function to avoid CORS/tainted canvas */
const viaProxy = (u?: string | null): string | undefined =>
  u ? (/^https?:\/\//i.test(u) ? `/api/pdf-proxy?url=${encodeURIComponent(u)}` : u) : undefined;

/** Resolve relative URLs (e.g. "/wp-content/...") against a base */
function absUrl(u?: string | null, base?: string): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u, base || (typeof window !== 'undefined' ? window.location.href : undefined)).toString();
  } catch {
    return u || undefined;
  }
}

/** Clean scraped text */
function cleanText(input?: string | null, maxLen = 800): string | undefined {
  if (!input) return undefined;
  let s = String(input);
  s = s.replace(/window\._wpemojiSettings[\s\S]*?\};?/gi, ' ');
  s = s.replace(/\/\*![\s\S]*?\*\//g, ' ');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/\S{160,}/g, ' ');         // very long “words” are usually minified blobs
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trimEnd() + '…';
  return s || undefined;
}

/** Normalize “specs” into [{label, value}] no matter what the scraper returns */
type KV = { label: string; value: string };
function normalizeSpecs(specs: unknown): KV[] {
  if (!specs) return [];
  // Already [{label,value}]
  if (Array.isArray(specs) && specs.every((x) => x && typeof x === 'object' && ('label' in (x as any) || 'value' in (x as any)))) {
    return (specs as any[]).map((s) => ({
      label: String((s as any).label ?? ''),
      value: String((s as any).value ?? ''),
    })).filter((s) => s.label || s.value);
  }
  // Array of strings like "Colour: Chrome"
  if (Array.isArray(specs) && specs.every((x) => typeof x === 'string')) {
    return (specs as string[])
      .map((line) => {
        const m = String(line).split(':');
        if (m.length >= 2) return { label: m[0].trim(), value: m.slice(1).join(':').trim() };
        return { label: '', value: line.trim() };
      })
      .filter((s) => s.label || s.value);
  }
  // Object map { Colour: 'Chrome', Size: '...' }
  if (specs && typeof specs === 'object') {
    return Object.entries(specs as Record<string, unknown>)
      .map(([k, v]) => ({ label: k, value: String(v ?? '') }))
      .filter((s) => s.label || s.value);
  }
  return [];
}

/** Small card for search results */
function ResultCard({
  r, onPick,
}: { r: { title: string; url: string; image?: string }; onPick: () => void }) {
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

/** Inline editable heading */
function EditableHeading({ title, onChange }: { title: string; onChange: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);
  function commit() {
    const v = (value || '').trim() || 'Untitled Section';
    onChange(v); setEditing(false);
  }
  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(title); setEditing(false); } }}
          className="text-lg font-semibold text-gray-800 border rounded px-2 py-1 w-full max-w-md"
          aria-label="Section title"
        />
      ) : (
        <h2 className="text-lg font-semibold text-gray-800 cursor-text" onDoubleClick={() => setEditing(true)} title="Double-click to rename section">
          {title}
        </h2>
      )}
      {!editing && (
        <button type="button" className="text-xs text-slate-600 hover:text-blue-600 underline" onClick={() => setEditing(true)}>
          Edit
        </button>
      )}
    </div>
  );
}

/** A single product block, styled like a slide for export */
function ProductSlide({
  product, onRemove, forExport = false,
}: { product: Product; onRemove: () => void; forExport?: boolean }) {
  const [specImg, setSpecImg] = useState<string | null>(null);

  // PDF first-page preview for spec sheet
  useEffect(() => {
    setSpecImg(null);
    const src = absUrl(product.specPdfUrl, product.sourceUrl);
    if (!src) return;

    let cancelled = false;
    (async () => {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(src)!, 1000);
        if (!cancelled) setSpecImg(png);
      } catch (e) {
        console.error('Failed to render PDF preview', e);
      }
    })();

    return () => { cancelled = true; };
  }, [product.specPdfUrl, product.sourceUrl]);

  const imgAbs = absUrl(product.image, product.sourceUrl);
  const imgProxied = viaProxy(imgAbs);
  const description = cleanText(product.description);
  const kvSpecs = useMemo(() => normalizeSpecs(product.specs), [product.specs]);

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 print:shadow-none">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: big product image (like PPT) */}
        <div className="flex flex-col gap-4">
          {imgProxied ? (
            <img
              src={imgProxied}
              alt={product.name ?? 'Product image'}
              className="w-full rounded-lg border object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : null}
          {specImg && (
            <img
              src={specImg}
              alt="Specifications preview"
              className="w-full rounded-lg border bg-white"
            />
          )}
        </div>

        {/* RIGHT: title, link, description, specs */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="m-0">{product.name ?? 'Selected product'}</h3>
              {product.sourceUrl && (
                <p className="m-0 text-sm">
                  <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 break-all">
                    {product.sourceUrl}
                  </a>
                </p>
              )}
              {product.code && <p className="text-sm text-slate-500 m-0">{product.code}</p>}
            </div>

            {!forExport && (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-lg border border-slate-300 text-slate-700 px-3 py-1.5 text-sm hover:bg-slate-50"
                title="Remove this product from the section"
              >
                Remove
              </button>
            )}
          </div>

          {description && <p className="mt-3">{description}</p>}

          {!!product.features?.length && (
            <>
              <h4 className="mt-4">Features</h4>
              <ul className="list-disc pl-5">
                {product.features!.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </>
          )}

          {!!kvSpecs.length && (
            <>
              <h4 className="mt-4">Specifications</h4>
              <table className="w-full text-sm">
                <tbody>
                  {kvSpecs.map((s, i) => (
                    <tr key={i} className="align-top">
                      <td className="font-medium pr-3 py-0.5 whitespace-nowrap">{s.label}</td>
                      <td className="py-0.5">{s.value}</td>
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

export default function SectionSlide({ section, onUpdate }: Props) {
  const [adding, setAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);

  const products = section.products ?? [];

  // migrate legacy single product -> products[0]
  useEffect(() => {
    if (section.product && (!section.products || section.products.length === 0)) {
      onUpdate({ ...section, products: [section.product], product: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Search / import ----------
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ title: string; url: string; image?: string }>>([]);

  async function search() {
    const term = q.trim();
    if (!term) return;
    setErrorMsg(null); setSearching(true); setResults([]);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { headers: { Accept: 'application/json' }});
      if (!res.ok) throw new Error(`Search failed (${res.status}).`);
      const data: any = await res.json().catch(() => ({}));
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.results) ? data.results
        : Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.data) ? data.data
        : [];
      const normalized = list.map((r: any) => ({
        title: r.title ?? r.name ?? r.text ?? 'Untitled',
        url: r.url ?? r.link ?? r.href ?? '',
        image: r.image ?? r.thumbnail ?? r.img ?? undefined,
      })).filter((r: any) => typeof r.url === 'string' && r.url.length > 0);
      setResults(normalized);
      if (normalized.length === 0) setErrorMsg('No results found for that query.');
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
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(u)}`, { headers: { Accept: 'application/json' }});
      if (!res.ok) throw new Error(`Import failed (${res.status}).`);
      const data: any = await res.json().catch(() => ({}));

      const p: Product = {
        id: data.code || data.id || crypto.randomUUID(),
        code: data.code ?? undefined,
        name: data.name || data.title || 'Imported Product',
        brand: data.brand ?? undefined,
        category: data.category ?? undefined,
        image: absUrl(data.image, u),
        gallery: Array.isArray(data.gallery)
          ? (data.gallery as any[]).map((g) => absUrl(String(g), u)).filter(Boolean) as string[]
          : undefined,
        description: cleanText(data.description),
        features: Array.isArray(data.features) ? data.features : undefined,
        specs: data.specs ?? undefined, // raw; normalized in component
        compliance: Array.isArray(data.compliance) ? data.compliance : undefined,
        tags: Array.isArray(data.tags) ? data.tags : undefined,
        sourceUrl: u,
        specPdfUrl: absUrl(data.specPdfUrl, u),
        assets: Array.isArray(data.assets)
          ? (data.assets as any[]).map((a: any) => {
              if (typeof a === 'string') {
                const uAbs = absUrl(a, u);
                return uAbs ? { url: uAbs } : null;
              }
              const uAbs = absUrl(a && a.url, u);
              if (!uAbs) return null;
              const lbl = typeof a?.label === 'string' ? a.label : undefined;
              return { url: uAbs, label: lbl };
            }).filter(Boolean) as any
          : undefined,
      };

      onUpdate({ ...section, products: [...products, p], product: undefined });
      setAdding(false); setQ(''); setResults([]);
    } catch (e: any) {
      console.error('import error', e);
      setErrorMsg(e?.message || 'Failed to import product details.');
    }
  }

  function removeProduct(id: string) {
    const next = (section.products ?? []).filter((p) => p.id !== id);
    onUpdate({ ...section, products: next });
  }

  async function exportThisSection() {
    if (!slideRef.current) return;
    const node = slideRef.current;
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const y = imgH > pageH ? 0 : (pageH - imgH) / 2;
    pdf.addImage(img, 'PNG', 0, y, imgW, imgH);
    pdf.save(`${section.title || 'section'}.pdf`);
  }

  const hasAny = (section.products?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <EditableHeading
          title={section.title || 'Untitled Section'}
          onChange={(t) => onUpdate({ ...section, title: t })}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            className="rounded-lg border border-slate-300 text-slate-700 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            {adding ? 'Cancel' : (hasAny ? 'Add product' : 'Add first product')}
          </button>
          {hasAny && (
            <button
              type="button"
              onClick={exportThisSection}
              className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-sm"
              title="Export this section to PDF"
            >
              Export PDF
            </button>
          )}
        </div>
      </div>

      {errorMsg && <div className="text-sm text-red-600" role="alert">{errorMsg}</div>}

      {/* Slide frame to mirror PPT look (two-column blocks) */}
      <div ref={slideRef} className="space-y-6 bg-white p-4 rounded-xl border">
        {(section.products ?? []).map((p) => (
          <ProductSlide key={p.id} product={p} onRemove={() => removeProduct(p.id)} />
        ))}

        {/* Search panel (shown when adding OR when none yet) */}
        {(adding || !hasAny) && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search Precero products (e.g. 'la casa 2 in 1')"
                className="flex-1 rounded-lg border px-3 py-2"
                onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
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

            {results.length === 0 && !searching && (
              <div className="text-sm text-slate-500">
                Type a query and click Search to add a product to this section.
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
        )}
      </div>
    </div>
  );
}
