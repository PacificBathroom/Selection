// src/components/ProductDrawer.tsx
import React, { useMemo, useState } from 'react';
import type { Section, Product, Asset } from '../types';

/** Resolve relative URLs (e.g. "/wp-content/...") against a base */
function absUrl(u?: string | null, base?: string): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u, base || (typeof window !== 'undefined' ? window.location.href : undefined)).toString();
  } catch {
    return u || undefined;
  }
}

/** Clean text from scraper noise (safe for older TS targets) */
function cleanText(input?: string | null, maxLen = 1200): string | undefined {
  if (!input) return undefined;
  let s = String(input);
  s = s.replace(/window\._wpemojiSettings[\s\S]*?\};?/gi, ' ');
  s = s.replace(/\/\*![\s\S]*?\*\//g, ' ');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/\S{160,}/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trimEnd() + '…';
  return s || undefined;
}

type Props = {
  open: boolean;
  onClose: () => void;
  section: Section;
  onUpdate: (next: Section) => void;
};

export default function ProductDrawer({ open, onClose, section, onUpdate }: Props) {
  const products: Product[] = useMemo(() => section.products ?? [], [section.products]);

  // --- Add by URL (uses your Netlify function /api/scrape) ---
  const [addUrl, setAddUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function addFromUrl() {
    const u = addUrl.trim();
    if (!u) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(u)}`, {
        headers: { Accept: 'application/json' },
      });
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
          ? (data.gallery as any[]).map((g) => absUrl(String(g), u)).filter(Boolean) as string[]
          : undefined,
        description: cleanText(data.description),
        features: Array.isArray(data.features) ? data.features : undefined,
        specs: Array.isArray(data.specs) || (data && typeof data.specs === 'object') ? data.specs : undefined,
        compliance: Array.isArray(data.compliance) ? data.compliance : undefined,
        tags: Array.isArray(data.tags) ? data.tags : undefined,
        sourceUrl: u,
        specPdfUrl: absUrl(data.specPdfUrl, u),
        assets: Array.isArray(data.assets)
          ? (data.assets as any[])
              .map((a: any) => {
                if (typeof a === 'string') {
                  const uAbs = absUrl(a, u);
                  return uAbs ? ({ url: uAbs } as Asset) : null;
                }
                const uAbs = absUrl(a?.url, u);
                if (!uAbs) return null;
                return { url: uAbs, label: typeof a?.label === 'string' ? a.label : undefined } as Asset;
              })
              .filter(Boolean) as Asset[]
          : undefined,
      };

      onUpdate({ ...section, products: [...products, p], product: undefined });
      setAddUrl('');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to import product details.');
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  function removeProduct(id: string) {
    const next = (section.products ?? []).filter((p) => p.id !== id);
    onUpdate({ ...section, products: next });
  }

  // Drawer hidden
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold m-0">Manage Products</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-2 py-1 text-sm"
          >
            Close
          </button>
        </div>

        {/* Add by URL */}
        <div className="bg-slate-50 border rounded-lg p-3 space-y-2 mb-4">
          <label className="text-sm block">
            <span className="block text-slate-600 mb-1">Import product from URL</span>
            <input
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="https://www.precero.com.au/product/..."
              className="w-full border rounded px-2 py-1"
              onKeyDown={(e) => { if (e.key === 'Enter') addFromUrl(); }}
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addFromUrl}
              disabled={busy || !addUrl.trim()}
              className="rounded bg-brand-600 text-white px-3 py-1.5 text-sm disabled:opacity-60"
            >
              {busy ? 'Importing…' : 'Import'}
            </button>
            {errorMsg && <div className="text-xs text-red-600">{errorMsg}</div>}
          </div>
        </div>

        {/* Current products */}
        <div className="space-y-3">
          {(products ?? []).length === 0 && (
            <div className="text-sm text-slate-500">No products in this section yet.</div>
          )}

          {(products ?? []).map((p: Product) => (
            <div key={p.id} className="flex items-start gap-3 border rounded-lg p-3">
              <div className="w-16 h-16 bg-slate-100 rounded overflow-hidden flex items-center justify-center border">
                {p.image ? (
                  <img src={p.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-400">no image</span>
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium">{p.name || 'Product'}</div>
                {p.code && <div className="text-xs text-slate-500">{p.code}</div>}
                {p.sourceUrl && (
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 break-all"
                  >
                    {p.sourceUrl}
                  </a>
                )}
                {cleanText(p.description) && (
                  <p className="text-xs text-slate-700 mt-1">{cleanText(p.description)}</p>
                )}
              </div>
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => removeProduct(p.id)}
                  className="rounded border border-rose-300 text-rose-700 px-2 py-1 text-xs hover:bg-rose-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
