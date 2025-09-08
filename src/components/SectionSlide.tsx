import React, { useState } from 'react';
import type { Section, Product } from '../types';

type Props = {
  section: Section;
  onUpdate: (next: Section) => void;
  index: number;
};

// One definition only (was duplicated before)
type SearchItem = { title: string; url: string; image?: string };

async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Expected JSON, got: ${text.slice(0, 120)}…`);
  }
  return res.json();
}

export default function SectionSlide({ section, onUpdate, index }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        '/.netlify/functions/search?q=' + encodeURIComponent(q)
      );
      const data = await safeJson(res);
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e: any) {
      setError(e?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function pick(item: SearchItem) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        '/.netlify/functions/scrape?url=' + encodeURIComponent(item.url)
      );
      const data = await safeJson(res);

      const product: Product = {
        id: data.id || crypto.randomUUID(),
        name: data.name || item.title,
        code: data.code,
        description: data.description,
        image: data.image || item.image,
        gallery: Array.isArray(data.gallery) ? data.gallery : [],
        features: Array.isArray(data.features) ? data.features : [],
        specs: Array.isArray(data.specs) ? data.specs : [],
        price: data.price,
        // Cast assets to the shape we use so TS doesn't complain about .href
        assets: (Array.isArray(data.assets) ? data.assets : []) as Array<{
          label?: string;
          href?: string;
        }>,
        sourceUrl: data.sourceUrl || item.url,
      };

      onUpdate({ ...section, product });
      setResults([]);
      setQuery('');
    } catch (e: any) {
      setError(e?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  const assets =
    (section.product?.assets as Array<{ label?: string; href?: string }> | undefined) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product name, e.g. la casa"
          className="w-full rounded-lg border px-3 py-2"
        />
        <button
          onClick={doSearch}
          className="rounded-lg bg-blue-600 text-white px-3 py-2"
          disabled={loading}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {/* Results grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => pick(r)}
              className="flex items-center gap-3 border rounded-lg p-3 text-left hover:bg-slate-50"
            >
              <div className="h-14 w-14 bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                {r.image ? (
                  <img src={r.image} alt="" className="h-full w-full object-contain" />
                ) : null}
              </div>
              <div className="text-sm">{r.title}</div>
            </button>
          ))}
        </div>
      )}

      {/* Selected product view */}
      {section.product ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="aspect-square rounded-lg border overflow-hidden bg-white flex items-center justify-center">
              {section.product.image ? (
                <img
                  src={section.product.image}
                  alt={section.product.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-slate-400 text-sm">No image</div>
              )}
            </div>

            {assets.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Downloads</h4>
                <ul className="space-y-1">
                  {assets.map((a, i) => (
                    <li key={i}>
                      <a
                        href={a.href || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        {a.label || a.href || 'Download'}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold leading-tight">
              {section.product.name}
            </h3>
            {section.product.code && (
              <p className="text-sm text-slate-500">{section.product.code}</p>
            )}
            {section.product.description && (
              <p className="text-slate-700">{section.product.description}</p>
            )}

            {section.product.features?.length ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Features</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {section.product.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {section.product.specs?.length ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Specs</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {section.product.specs.map((s, i) => (
                    <div key={i} className="flex justify-between gap-3">
                      <span className="text-slate-600">{s.label}</span>
                      <span className="font-medium">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-slate-500 text-sm">
          Search and pick a product to populate this page.
        </p>
      )}
    </div>
  );
}
