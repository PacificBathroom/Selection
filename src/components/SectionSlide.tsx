// src/components/SectionSlide.tsx
import { fetchProducts, type ProductRow } from "../api/sheets";
// ...
const [items, setItems] = useState<ProductRow[]>([]);
useEffect(() => { fetchProducts({ q: search, category }).then(setItems).catch(console.error); }, [search, category]);

import { renderPdfFirstPageToDataUrl } from '../utils/pdfPreview';

type Props = { section: Section; onUpdate: (next: Section) => void };

/** Proxy external assets so canvases remain untainted */
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

/** Clean up scraped blobs of script/style text */
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

/* ---------- Small card for search results ---------- */
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

/* ---------- Product card inside a section ---------- */
function ProductCard({ product, onRemove }: { product: Product; onRemove: () => void }) {
  const [specImg, setSpecImg] = useState<string | null>(null);

  // Render 1st page of spec PDF (via proxy) into PNG
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
    return () => {
      cancelled = true;
    };
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 rounded-xl shadow-sm border">
      <div>
        {imgProxied && (
          <img
            src={imgProxied}
            alt={product.name ?? 'Product image'}
            className="w-full rounded-lg border"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              // If proxy fails, hide (to avoid tainted canvas by falling back to raw)
              e.currentTarget.style.display = 'none';
            }}
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
            <ul>{product.compliance!.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
          </>
        )}

        {!!product.features?.length && (
          <>
            <h4>Features</h4>
            <ul>{product.features!.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul>
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
              <ul>{(product.specs as any[]).map((s: any, i: number) => <li key={i}>{String(s)}</li>)}</ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Main SectionSlide ---------- */
export default function SectionSlide({ section, onUpdate }: Props) {
  // Normalize products (and migrate legacy single product once)
  const products: Product[] = Array.isArray(section.products)
    ? section.products
    : section.product
    ? [section.product as Product]
    : [];

  useEffect(() => {
    if (section.product && !Array.isArray(section.products)) {
      onUpdate({ ...section, products: products, product: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [adding, setAdding] = useState<boolean>(products.length === 0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search/import state
  const [q, setQ] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [results, setResults] = useState<Array<{ title: string; url: string; image?: string }>>([]);

  async function search() {
    const term = q.trim();
    if (!term) return;
    setErrorMsg(null);
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Search failed (${res.status}). ${txt.slice(0, 200)}`);
      }
      const data: any = await res.json().catch(() => ({}));
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];
      const normalized = list
        .map((r: any) => ({
          title: r.title ?? r.name ?? r.text ?? 'Untitled',
          url: r.url ?? r.link ?? r.href ?? '',
          image: r.image ?? r.thumbnail ?? r.img ?? undefined,
        }))
        .filter((r: any) => typeof r.url === 'string' && r.url.length > 0);
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
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(u)}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Import failed (${res.status}). ${txt.slice(0, 200)}`);
      }
      const data: any = await res.json().catch(() => ({}));
      const p: Product = {
        id: data.code || data.id || crypto.randomUUID(),
        code: data.code ?? undefined,
        name: data.name || data.title || 'Imported Product',
        brand: data.brand ?? undefined,
        category: data.category ?? undefined,
        image: absUrl(data.image, u),
        gallery: Array.isArray(data.gallery)
          ? (data.gallery as any[]).map((g: any) => absUrl(String(g), u)).filter(Boolean) as string[]
          : undefined,
        description: cleanText(data.description),
        features: Array.isArray(data.features) ? data.features : undefined,
        specs: Array.isArray(data.specs) ? data.specs : undefined,
        compliance: Array.isArray(data.compliance) ? data.compliance : undefined,
        tags: Array.isArray(data.tags) ? data.tags : undefined,
        sourceUrl: u,
        specPdfUrl: absUrl(data.specPdfUrl, u),
        assets: Array.isArray(data.assets)
          ? (data.assets as any[])
              .map((a: any) => {
                if (typeof a === 'string') {
                  const uAbs = absUrl(a, u);
                  return uAbs ? { url: uAbs } : null;
                }
                const uAbs = absUrl(a && a.url, u);
                if (!uAbs) return null;
                const lbl = typeof a?.label === 'string' ? a.label : undefined;
                return { url: uAbs, label: lbl };
              })
              .filter(Boolean) as any
          : undefined,
      };

      const next = [...products, p];
      onUpdate({ ...section, products: next, product: undefined });
      setAdding(false);
      setQ('');
      setResults([]);
    } catch (e: any) {
      console.error('import error', e);
      setErrorMsg(e?.message || 'Failed to import product details.');
    }
  }

  function removeProduct(id: string) {
    const next = products.filter((p) => p.id !== id);
    onUpdate({ ...section, products: next });
  }

  const hasAny =
  Array.isArray(section.products) ? section.products.length > 0 : !!section.product;

  return (
    <div className="space-y-4">
      {/* Header row (non-editable) */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{section.title || 'Section'}</h2>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="rounded-lg border border-slate-300 text-slate-700 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {adding ? 'Cancel' : hasAny ? 'Add product' : 'Add first product'}
        </button>
      </div>

      {errorMsg && (
        <div className="text-sm text-red-600" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Product list */}
      <div className="space-y-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onRemove={() => removeProduct(p.id)} />
        ))}

        {/* Search panel (visible when adding OR when no products yet) */}
        {(adding || !hasAny) && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
                placeholder="Search Precero products (e.g. 'la casa 2 in 1')"
                className="flex-1 rounded-lg border px-3 py-2"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
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
