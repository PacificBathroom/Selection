import React, { useState } from 'react';
import type { Section, Product, Asset, Spec } from '../types';

type Props = {
  section: Section;
  onUpdate: (next: Section) => void;
};

// Result item from the search function
type SearchItem = {
  title: string;
  url: string;
  image?: string;
};

async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Expected JSON, got: ${text.slice(0, 160)}…`);
  }
  return res.json();
}

export default function SectionSlide({ section, onUpdate }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const product = section.product;

  async function doSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        '/.netlify/functions/search?q=' + encodeURIComponent(q)
      );
      const data: { results?: SearchItem[] } = await safeJson(res);
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function pick(item: SearchItem) {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        '/.netlify/functions/scrape?url=' + encodeURIComponent(item.url)
      );
      const data: Partial<Product> & {
        id?: string;
        assets?: Array<Partial<Asset>>;
        specs?: Array<Partial<Spec>>;
      } = await safeJson(res);

      // normalize arrays
      const gallery = Array.isArray(data.gallery) ? data.gallery.filter(Boolean) as string[] : [];
      const features = Array.isArray(data.features) ? (data.features.filter(Boolean) as string[]) : [];
      const specs = Array.isArray(data.specs)
        ? (data.specs
            .filter((s): s is Spec => !!s && !!s.label && !!s.value)
            .map((s) => ({ label: String(s.label), value: String(s.value) })) as Spec[])
        : [];
      const assets = Array.isArray(data.assets)
        ? (data.assets
            .filter((a): a is Asset => !!a && (!!a.href || !!a.url || !!a.label))
            .map((a) => ({
              label: a.label,
              href: a.href ?? a.url,
              url: a.url ?? a.href,
            })) as Asset[])
        : [];

      const nextProduct: Product = {
        id: data.id || crypto.randomUUID(),
        name: data.name || item.title,
        code: data.code,
        description: data.description,
        image: data.image || item.image,
        gallery,
        features,
        specs,
        price: data.price,
        assets,
        sourceUrl: data.sourceUrl || item.url,
        brand: data.brand,
        tags: Array.isArray(data.tags) ? (data.tags.filter(Boolean) as string[]) : [],
        compliance: Array.isArray(data.compliance) ? (data.compliance.filter(Boolean) as string[]) : [],
      };

      onUpdate({ ...section, product: nextProduct });
      setResults([]);
      setQuery('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Section title inline edit (handled in parent via input) */}

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Precero products… e.g. messina diverter"
          className="w-full rounded-lg border px-3 py-2"
        />
        <button
          onClick={doSearch}
          disabled={loading}
          className="rounded-lg bg-blue-600 text-white px-3 py-2"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {/* Search results */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {results.map((r, i) => (
            <button
              key={`${r.url}-${i}`}
              onClick={() => pick(r)}
              className="flex items-center gap-3 border rounded-lg p-3 text-left hover:bg-slate-50"
            >
              <div className="h-14 w-14 bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                {r.image ? (
                  <img src={r.image} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="text-xs text-slate-400">No image</div>
                )}
              </div>
              <div className="text-sm leading-snug line-clamp-3">{r.title}</div>
            </button>
          ))}
        </div>
      )}

      {/* Selected product */}
      {product ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Image + downloads */}
          <div>
            <div className="aspect-square rounded-lg border overflow-hidden bg-white flex items-center justify-center">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-slate-400 text-sm">No image</div>
              )}
            </div>

            {Array.isArray(product.assets) && product.assets.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Downloads</h4>
                <ul className="space-y-1">
                  {product.assets.map((a, i) => {
                    const href = a.href ?? a.url;
                    return (
                      <li key={i}>
                        <a
                          href={href || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                        >
                          {a.label || href || 'Download'}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="space-y-3">
            <h3 className="text-xl font-semibold leading-tight">{product.name}</h3>
            {product.code && (
              <p className="text-sm text-slate-500">{product.code}</p>
            )}

            {product.description && (
              <p className="text-slate-700">{product.description}</p>
            )}

            {product.features && product.features.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Features</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {product.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {product.specs && product.specs.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Specifications</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {product.specs.map((s, i) => (
                    <div key={i} className="flex justify-between gap-3">
                      <span className="text-slate-600">{s.label}</span>
                      <span className="font-medium">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {product.compliance && product.compliance.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Compliance</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {product.compliance.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.tags.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-slate-600"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-slate-500 text-sm">
          Search and select a product to populate this page.
        </p>
      )}
    </div>
  );
}
