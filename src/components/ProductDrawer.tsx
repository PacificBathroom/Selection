// src/components/ProductDrawer.tsx
import React, { useRef } from "react";
import { Product } from "../types";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type Props = {
  product?: Product;
  onClose: () => void;
};

export default function ProductDrawer({ product, onClose }: Props) {
  // ✅ Prevents TS18048: ensures we never render without a product
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
    pdf.save(`${product.code || product.id}.pdf`);
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        <div className="p-6 border-b flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold leading-tight">{product.name}</h2>
            {product.code && <p className="text-sm text-slate-500">{product.code}</p>}
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

        <div ref={contentRef} className="p-6 space-y-4">
