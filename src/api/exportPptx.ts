// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// ✅ Vite-friendly worker URL (and types via our shim file)
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as pdfjsLib from "pdfjs-dist";
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

async function fetchAsDataUrl(url?: string): Promise<string | undefined> {
  try {
    if (!url) return undefined;
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

async function pdfFirstPageToPng(pdfUrl?: string): Promise<string | undefined> {
  try {
    if (!pdfUrl) return undefined;

    // ✅ Use the already-imported pdfjsLib & workerSrc
    const doc = await (pdfjsLib as any)
      .getDocument({ url: pdfUrl, useSystemFonts: true })
      .promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;

    return canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
}

export async function exportSelectionToPptx(
  products: Product[],
  client: ClientInfo
) {
  const pptx = new PptxGenJS();
  (pptx as any).title = client.projectName || "Product Presentation";
  (pptx as any).layout = "LAYOUT_16x9";

  const brand = {
    bg: "FFFFFF",
    text: "111111",
    accent: "3056D3",
    faint: "F3F4F6",
  };

  // Cover
  {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };
    s.add
