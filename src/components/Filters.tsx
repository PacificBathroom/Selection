import React from 'react';

type Props = { query: string; setQuery: (v: string) => void; categories: string[]; activeCategory: string | null; setActiveCategory: (c: string | null) => void; };

export default function Filters({ query, setQuery, categories, activeCategory, setActiveCategory }: Props) {
  return (
    <aside className="hidden lg:block lg:w-64 xl:w-72 shrink-0">
      <div className="sticky top-[4.25rem] space-y-4 p-4">
        <div>
          <label className="text-xs font-semibold text-slate-600">Search or paste URL</label>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Try: La Casa, AS1428, TAP59103 or https://..." className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Category</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={() => setActiveCategory(null)} className={`rounded-lg border px-3 py-2 text-sm ${!activeCategory ? 'bg-brand-600 text-white border-brand-600' : 'bg-white hover:bg-slate-50'}`}>All</button>
            {categories.map(c => (
              <button key={c} onClick={() => setActiveCategory(c)} className={`rounded-lg border px-3 py-2 text-sm text-left ${activeCategory === c ? 'bg-brand-600 text-white border-brand-600' : 'bg-white hover:bg-slate-50'}`}>{c}</button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
