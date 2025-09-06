import React, { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import Filters from './components/Filters';
import ProductCard from './components/ProductCard';
import ProductDrawer from './components/ProductDrawer';
import { products as seed } from './data/products';
import { Product } from './types';

export default function App() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [items, setItems] = useState<Product[]>(seed);
  const [active, setActive] = useState<Product | null>(seed[0] ?? null);

  const categories = useMemo(() => {
    const set = new Set(items.map(i => i.category).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [items]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(p => {
      const matchesQ = !q || (
        (p.name?.toLowerCase().includes(q)) ||
        (p.code?.toLowerCase().includes(q)) ||
        (p.description?.toLowerCase().includes(q)) ||
        (p.features || []).some(f => f.toLowerCase().includes(q)) ||
        (p.specs || []).some(s => s.label.toLowerCase().includes(q) || s.value.toLowerCase().includes(q))
      );
      const matchesC = !activeCategory || p.category === activeCategory;
      return matchesQ && matchesC;
    });
  }, [items, query, activeCategory]);

  useEffect(() => { if (list.length > 0) setActive(list[0]); else setActive(null); }, [list]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        const looksLikeUrl = /^https?:\/\//i.test(query.trim());
        if (looksLikeUrl) importFromUrl(query.trim()).catch(err => alert(err.message));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [query]);

  async function importFromUrl(url: string) {
    const endpoint = '/.netlify/functions/scrape?url=' + encodeURIComponent(url);
    const res = await fetch(endpoint);
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Import failed');
    }
    const data = await res.json();

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

    setItems(prev => [product, ...prev]);
    setActive(product);
    setQuery('');
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6">
          <Filters query={query} setQuery={setQuery} categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
          <section className="flex-1">
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-800 text-white p-6">
              <h2 className="text-xl font-semibold">Curated Selection</h2>
              <p className="text-sm text-brand-100">Type to search; the best match opens automatically. Paste a URL and press Enter to import.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {list.map(p => (<ProductCard key={p.id} product={p} onSelect={setActive} />))}
            </div>
            {list.length === 0 && (<div className="text-center text-slate-500 py-20">No products match your filters.</div>)}
          </section>
        </div>
      </main>
      <ProductDrawer product={active} onClose={() => setActive(null)} />
    </div>
  );
}
