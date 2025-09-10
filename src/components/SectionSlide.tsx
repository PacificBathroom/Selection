import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Section, Product } from '../types';
import { renderPdfFirstPageToDataUrl } from '../utils/pdfPreview';

type Props = { section: Section; onUpdate: (next: Section) => void };

const viaProxy = (u?: string | null) =>
  u && /^https?:\/\//i.test(u) ? `/api/pdf-proxy?url=${encodeURIComponent(u)}` : u || undefined;

function absUrl(u?: string | null, base?: string): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u, base || (typeof window !== 'undefined' ? window.location.href : undefined)).toString();
  } catch {
    return u || undefined;
  }
}
function cleanText(input?: string | null, maxLen = 1200): string | undefined {
  if (!input) return undefined;
  let s = String(input);
  s = s.replace(/window\._wpemojiSettings[\s\S]*?\};?/gi, ' ');
  s = s.replace(/\/\*![\s\S]*?\*\//g, ' ');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/\S{120,}/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trimEnd() + '…';
  return s || undefined;
}

function ResultCard({ r, onPick }: { r: { title: string; url: string; image?: string }; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="flex items-center gap-3 p-3 rounded-lg border w-full text-left hover:bg-slate-50">
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

function ProductCard({ product, onRemove }: { product: Product; onRemove: () => void }) {
  const [specImg, setSpecImg] = useState<string | null>(null);
  useEffect(() => {
    setSpecImg(null);
    const src = absUrl(product.specPdfUrl, product.sourceUrl);
    if (!src) return;
    let cancelled = false;
    (async () => {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(src)!, 1000);
        if (!cancelled) setSpecImg(png);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [product.specPdfUrl, product.sourceUrl]);

  const imgAbs = absUrl(product.image, product.sourceUrl);
  const imgProxied = viaProxy(imgAbs);

  const hasTableLikeSpecs = useMemo(() => {
    const s = product?.specs;
    if (!Array.isArray(s) || s.length === 0) return false;
    const first = s[0] as any;
    return typeof first === 'object' && first && ('label' in first || 'value' in first);
  }, [product?.specs]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 rounded-xl border">
      <div>
        {imgProxied && (
          <img
            src={imgProxied}
            alt={product.name ?? 'Product image'}
            className="w-full rounded-lg border"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {specImg && (
          <img src={specImg} alt="Specifications preview" className="w-full mt-4 rounded-lg border bg-white" />
        )}
      </div>

      <div className="prose max-w-none">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="m-0">{product.name ?? 'Selected product'}</h3>
            {product.code && <p className="text-sm text-slate-500 m-0">{product.code}</p>}
            {product.sourceUrl && (
              <p className="m-0">
                <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 break-all">
                  {product.sourceUrl}
                </a>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-slate-300 text-slate-700 px-3 py-1.5 text-sm hover:bg-slate-50"
            title="Remove this product from the section"
          >
            Remove
          </button>
        </div>

        {cleanText(product.description) && <p>{cleanText(product.description)}</p>}

        {!!product.compliance?.length && (
          <>
            <h4>Compliance</h4>
            <ul>{product.compliance!.map((c: string, i: number) => (<li key={i}>{c}</li>))}</ul>
          </>
        )}

        {!!product.features?.length && (
          <>
            <h4>Features</h4>
            <ul>{product.features!.map((f: string, i: number) => (<li key={i}>{f}</li>))}</ul>
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
              <ul>{(product.specs as any[]).map((s: any, i: number) => (<li key={i}>{String(s)}</li>))}</ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SectionSlide({ section, onUpdate }: Props) {
  const products = section.products ?? [];
  const [adding, setAdding] = useState(products.length === 0);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ title: string; url: string; image?: string }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function search() {
    const term = q.trim();
    if (!term) return;
    setErrorMsg(null); setSearching(true); setResults([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { headers: { Accept: 'application/json' }});
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data) ? data :
                   Array.isArray(data?.results) ? data.results :
                   Array.isArray(data?.items) ? data.items :
                   Array.isArray(data?.data) ? data.data : [];
      const normalized = list.map((r: any) => ({
        title: r.title ?? r.name ?? r.text ?? 'Untitled',
        url: r.url ?? r.link ?? r.href ?? '',
        image: r.image ?? r.thumbnail ?? r.img ?? undefined,
      })).filter((r: any) => typeof r.url === 'string' && r.url.length > 0);
      setResults(normalized);
      if (normalized.length === 0) setErrorMsg('No results found for that query.');
    } catch (e: any) {
      console.error('search error', e);
      setErrorMsg(e?.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  async function importUrl(u: string) {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(u)}`, { headers: { Accept: 'application/json' }});
      if (!res.ok) throw new Error(`Import failed (${res.status})`);
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
        specs: Array.isArray(data.specs) ? data.specs : undefined,
        compliance: Array.isArray(data.compliance) ? data.compliance : undefined,
        tags: Array.isArray(data.tags) ? data.tags : undefined,
        sourceUrl: u,
        specPdfUrl: absUrl(data.specPdfUrl, u),
        assets: undefined,
      };
      onUpdate({ ...section, products: [...products, p] });
      setAdding(false);
      setQ(''); setResults([]);
    } catch (e: any) {
      console.error('import error', e);
      setErrorMsg(e?.message || 'Failed to import product.');
    }
  }

  function removeProduct(id: string) {
    onUpdate({ ...section, products: (section.products ?? []).filter((p) => p.id !== id) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-medium text-slate-800">{section.title || 'Section'}</div>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="rounded-lg border border-slate-300 text-slate-700 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {adding ? 'Cancel' : 'Add product'}
        </button>
      </div>

      {(section.products ?? []).map((p) => (
        <ProductCard key={p.id} product={p} onRemove={() => removeProduct(p.id)} />
      ))}

      {(adding || (section.products?.length ?? 0) === 0) && (
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
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}
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
  );
}
