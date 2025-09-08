// at top of file
type SearchItem = { title: string; url: string; image?: string };

async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Expected JSON, got: ${text.slice(0,120)}…`);
  }
  return res.json();
}
import React, { useState } from 'react';
import type { Section, Product } from '../types';

type Props = {
  section: Section;
  onUpdate: (s: Section) => void;
  index?: number; // accept index from parent
};

type SearchItem = { title: string; url: string; image?: string };

export default function SectionSlide({ section, onUpdate, index }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function doSearch() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/.netlify/functions/search?q=' + encodeURIComponent(query));
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e: any) {
      setError(e?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function pick(item: SearchItem) {
    try {
      setLoading(true);
      const res = await fetch('/.netlify/functions/scrape?url=' + encodeURIComponent(item.url));
      const data = await res.json();
      const product: Product = {
        id: data.id || crypto.randomUUID(),
        name: data.name || item.title,
        code: data.code,
        description: data.description,
        image: data.image || item.image,
        gallery: data.gallery,
        specs: data.specs || [],
        features: data.features || [],
        assets: data.assets || [],
        price: data.price,
        sourceUrl: data.sourceUrl || item.url,
      } as Product;
      onUpdate({ ...section, product });
      setResults([]);
      setQuery('');
    } catch (e: any) {
      setError(e?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{section.title}</h3>
        {(typeof index === 'number' || typeof (section as any).order === 'number') && (
          <span className="text-xs text-slate-500">Section { (typeof index === 'number' ? index + 1 : (section as any).order) }</span>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search Precero products (e.g., Messina diverter)"
          className="flex-1 rounded-lg border px-3 py-2"
          onKeyDown={e => e.key === 'Enter' && doSearch()}
        />
        <button onClick={doSearch} className="rounded-lg bg-blue-600 text-white px-4 py-2">Search</button>
      </div>
      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
      {loading && <div className="text-sm text-slate-500 mb-2">Loading…</div>}

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {results.map((r, idx) => (
            <button
              key={idx}
              onClick={() => pick(r)}
              className="flex items-center gap-3 text-left border rounded-lg p-3 hover:bg-slate-50"
              title="Click to use this product on the page"
            >
              <div className="h-12 w-12 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                {r.image ? <img src={r.image} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="font-medium">{r.title}</div>
            </button>
          ))}
        </div>
      )}

      {!results.length && !section.product && (
        <p className="text-xs text-slate-500 mt-3">Search and pick a product to populate this page.</p>
      )}

      {section.product && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
              {section.product.image ? (
                <img src={section.product.image} alt={section.product.name} className="h-full w-full object-contain" />
              ) : (
                <div className="text-slate-400 text-sm">No image</div>
              )}
            </div>
            {section.product.sourceUrl && (
              <div className="mt-3 text-sm text-slate-500">
                Source: <a href={section.product.sourceUrl} className="underline" target="_blank" rel="noreferrer">{section.product.sourceUrl}</a>
              </div>
            )}
          </div>
          <div>
            <h4 className="text-xl font-semibold">{section.product.name}</h4>
            {section.product.code && <div className="text-slate-500 mb-2">Code: {section.product.code}</div>}
            {section.product.description && <p className="text-slate-700 mb-3">{section.product.description}</p>}

            {(section.product.features?.length ?? 0) > 0 && (
              <div className="mb-4">
                <div className="text-sm font-semibold mb-1">Features</div>
                <ul className="list-disc ml-5 text-sm text-slate-700 space-y-1">
                  {(section.product.features ?? []).slice(0,8).map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}

            {(section.product.specs?.length ?? 0) > 0 && (
              <div>
                <div className="text-sm font-semibold mb-1">Specifications</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {(section.product.specs ?? []).slice(0,12).map((s, i) => (
                    <div key={i} className="border rounded-lg p-2">
                      <div className="text-slate-500">{s.label}</div>
                      <div className="font-medium">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
