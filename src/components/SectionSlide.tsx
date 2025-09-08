import React, { useState } from 'react';
import { Product, Section } from '../types';

type Props = {
  section: Section;
  onUpdate: (s: Section) => void;
  index: number;
};

async function searchPrecero(query: string) {
  const res = await fetch(`/.netlify/functions/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return (data.results ?? []) as { title: string; url: string; image?: string }[];
}

async function importFromUrl(url: string) {
  const res = await fetch(`/.netlify/functions/scrape?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error('Import failed');
  return await res.json();
}

export default function SectionSlide({ section, onUpdate, index }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ title: string; url: string; image?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function onSearch() {
    setLoading(true);
    try {
      const r = await searchPrecero(query);
      setResults(r.slice(0, 8));
    } finally {
      setLoading(false);
    }
  }

  async function onPick(url: string) {
    setLoading(true);
    try {
      const data = await importFromUrl(url);
      const product: Product = {
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
        finish: data.finish,
        colourOptions: data.colourOptions,
        price: data.price,
        assets: data.assets,
        tags: data.tags,
        sourceUrl: url,
      };
      onUpdate({ ...section, product });
      setResults([]);
      setQuery('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border shadow-card p-5 space-y-4" id={`slide-${section.id}`}>
      <div className="flex items-center gap-3">
        <input
          value={section.title}
          onChange={e => onUpdate({ ...section, title: e.target.value })}
          className="text-lg font-semibold border-b border-dashed focus:outline-none flex-1"
          aria-label={`Section title ${index+1}`}
        />
        <span className="text-xs text-slate-500">Section {index + 1}</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => (e.key === 'Enter' ? onSearch() : null)}
          placeholder="Search Precero product (e.g. La Casa, Diverter Mixer, SKU)…"
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          onClick={onSearch}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-brand-600 text-white px-3 py-2 text-sm disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2">
          {results.map(r => (
            <button
              key={r.url}
              onClick={() => onPick(r.url)}
              className="flex items-center gap-3 rounded-lg border p-2 text-left hover:bg-slate-50"
            >
              {r.image ? (
                <img src={r.image} className="h-12 w-12 object-cover rounded" />
              ) : (
                <div className="h-12 w-12 rounded bg-slate-200" />
              )}
              <div className="text-sm">{r.title}</div>
            </button>
          ))}
        </div>
      )}

      {section.product ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden">
              {section.product.image ? (
                <img src={section.product.image} alt={section.product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400">No image</div>
              )}
            </div>
            {(section.product.gallery ?? []).length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {(section.product.gallery ?? []).map((g, i) => (
                  <img key={i} src={g} className="h-20 w-full object-cover rounded-lg" />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">
                {section.product.name}{' '}
                {section.product.code && <span className="text-slate-500 text-sm">({section.product.code})</span>}
              </h3>
              {section.product.description && <p className="text-slate-700">{section.product.description}</p>}
            </div>

            {(section.product.features ?? []).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Key Features</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-700 text-sm">
                  {(section.product.features ?? []).map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}

            {(section.product.specs ?? []).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Technical Specifications</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {(section.product.specs ?? []).map((s, i) => (
                    <div key={i} className="flex justify-between border-b py-1">
                      <span className="text-slate-500">{s.label}</span>
                      <span className="font-medium">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(section.product.assets ?? []).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Resources & Downloads</h4>
                <div className="flex flex-wrap gap-2">
                  {(section.product.assets ?? []).map((a, i) => (
                    <a key={i} href={a.url} target="_blank" className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">{a.label}</a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-500">Search and pick a product to populate this page.</div>
      )}
    </div>
  );
}
