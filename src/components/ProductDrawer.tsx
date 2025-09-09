// src/components/ProductDrawer.tsx
import React, { useRef } from "react";
import type { Product, Asset } from "../types";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type Props = {
  product?: Product; // undefined when closed
  onClose: () => void;
};

export default function ProductDrawer({ product, onClose }: Props) {
  // Guard to satisfy TS and avoid rendering with no product
  if (!product) return null;

  const contentRef = useRef<HTMLDivElement>(null);

  async function exportPDF() {
    if (!contentRef.current) return;
    const canvas = await html2canvas(contentRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const imgH = (canvas.height * pageW) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pageW, imgH);
    pdf.save(`${(product.code || product.name || "product").replace(/\s+/g, "_")}.pdf`);
  }

  // normalize assets so either .href or .url works
  const normalizedAssets: Asset[] = (product.assets ?? []).map((a) => ({
    label: a.label,
    href: a.href ?? a.url,
    url: a.url ?? a.href,
  }));

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* drawer */}
      <div
        className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto"
        aria-modal="true"
        role="dialog"
      >
        {/* header */}
        <div className="p-6 border-b flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold leading-tight">{product.name}</h2>
            {product.code ? (
              <p className="text-sm text-slate-500">{product.code}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPDF}
              className="rounded-lg bg-brand-600 text-white px-3 py-2 text-sm shadow hover:opacity-90"
            >
              Export PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        {/* content */}
        <div ref={contentRef} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* left column */}
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

            {normalizedAssets.length > 0 ? (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Downloads</h4>
                <ul className="space-y-1">
                  {normalizedAssets.map((a, i) => {
                    const href = a.href ?? a.url;
                    return (
                      <li key={i}>
                        <a
                          href={href || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                        >
                          {a.label || href || "Download"}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>

          {/* right column */}
          <div className="space-y-3">
            {product.brand ? (
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {product.brand}
              </div>
            ) : null}

            {product.description ? (
              <p className="text-slate-700">{product.description}</p>
            ) : null}

            {product.features && product.features.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Features</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {product.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {product.specs && product.specs.length > 0 ? (
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
            ) : null}

            {product.compliance && product.compliance.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Compliance</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {product.compliance.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {product.tags && product.tags.length > 0 ? (
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
            ) : null}
          </div>
        </div>
        {/* /content */}
      </div>
      {/* /drawer */}
    </div>
  );
}
