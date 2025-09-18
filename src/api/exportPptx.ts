// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// PDF.js setup (one source of truth)
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as pdfjsLib from "pdfjs-dist";
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

// Proxy to bypass CORS for images & PDFs
const PROXY = (u: string) => `/api/pdf-proxy?url=${encodeURIComponent(u)}`;

// Turn a remote file into a data: URL (prefers proxy)
async function fetchAsDataUrl(url?: string): Promise<string | undefined> {
  try {
    if (!url) return undefined;
    const res = await fetch(PROXY(url));
    if (!res.ok) return undefined;
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result is already data:URL; rebuild with preserved content-type just in case
        const base64 = String(reader.result).split(",")[1] ?? "";
        resolve(`data:${contentType};base64,${base64}`);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    try {
      if (!url) return undefined;
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) return undefined;
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  }
}

// Render first page of a PDF to PNG (uses proxy URL to avoid CORS)
async function pdfFirstPageToPng(pdfUrl?: string): Promise<string | undefined> {
  try {
    if (!pdfUrl) return undefined;
    const doc = await (pdfjsLib as any)
      .getDocument({ url: PROXY(pdfUrl), useSystemFonts: true })
      .promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1.35 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/png");
  } catch {
    return fetchAsDataUrl(pdfUrl);
  }
}

// Build [label,value] pairs from either specs array or a string blob
function toSpecPairs(p: Product): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (Array.isArray((p as any).specs)) {
    for (const it of (p as any).specs) {
      const label = String(it?.label ?? "").trim();
      const value = String(it?.value ?? "").trim();
      if (label || value) rows.push([label, value]);
    }
  } else if (typeof (p as any).specifications === "string") {
    const parts = (p as any).specifications.split(/\r?\n|\|/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const m = part.match(/^(.+?)\s*[:\-–]\s*(.+)$/);
      if (m) rows.push([m[1].trim(), m[2].trim()]);
      else rows.push(["", part]);
    }
  }
  return rows.slice(0, 10);
}

export async function exportSelectionToPptx(products: Product[], client: ClientInfo) {
  const pptx = new PptxGenJS();
  pptx.title = client.projectName || "Product Presentation";
  pptx.layout = "LAYOUT_16x9";

  const brand = {
    bg: "FFFFFF",
    text: "0F172A",
    accent: "1E6BD7",
    faint: "F1F5F9",
    bar: "24D3EE",
  };

  // Cover slide
  {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };
    s.addText(client.projectName || "Project Selection", {
      x: 0.8, y: 1.4, w: 8.5, h: 1, fontFace: "Inter", fontSize: 40, bold: true, color: brand.text,
    } as any);
    if (client.clientName) {
      s.addText(`Client: ${client.clientName}`, {
        x: 0.8, y: 2.4, w: 8.5, h: 0.6, fontFace: "Inter", fontSize: 20, color: brand.text,
      } as any);
    }
    if (client.dateISO) {
      s.addText(client.dateISO, {
        x: 0.8, y: 3.0, w: 8.5, h: 0.5, fontFace: "Inter", fontSize: 14, color: "666666",
      } as any);
    }
  }

  // Layout constants (fit everything within 10 x 5.625 inches)
  const L = {
    leftImg:   { x: 0.6,  y: 1.0, w: 5.0, h: 3.6 },
    rightPane: { x: 6.0,  y: 1.0, w: 3.6, h: 3.9 },
    rightTitle:{ x: 6.0,  y: 1.0, w: 3.6, h: 0.7 },
    rightSku:  { x: 6.0,  y: 1.7, w: 3.6, h: 0.4 },
    rightTableY: 2.2,
    descBox:   { x: 0.6,  y: 4.45, w: 9.0, h: 0.55 },
    bottomBar: { x: 0.0,  y: 5.30, w: 10.0, h: 0.23 },
    codeText:  { x: 0.7,  y: 5.05, w: 4.5, h: 0.25 },
  };

  // Product slides
  for (const p of products) {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    const title  = p.name || p.product || "Untitled Product";
    const code   = p.code || p.sku || "";
    const url    = (p as any).url || p.pdfUrl || p.specPdfUrl;
    const imgUrl = p.imageUrl || p.image || p.thumbnail;

    // Debug: see data in browser console during export
    console.log("PPT item", {
      title,
      imageUrl: imgUrl,
      pdfUrl: p.pdfUrl || p.specPdfUrl,
      hasSpecsArray: Array.isArray((p as any).specs),
      specsCount: Array.isArray((p as any).specs) ? (p as any).specs.length : 0,
      specifications: typeof (p as any).specifications === "string"
        ? (p as any).specifications.slice(0, 80)
        : undefined,
    });

    // LEFT: Product image
    const imgData = await fetchAsDataUrl(imgUrl);
    if (imgData) {
      s.addImage({ data: imgData, ...L.leftImg, sizing: { type: "contain", w: L.leftImg.w, h: L.leftImg.h } } as any);
    } else {
      s.addShape(pptx.ShapeType.roundRect, {
        ...L.leftImg, fill: { color: brand.faint }, line: { color: "D0D7E2", width: 1 },
      } as any);
    }

    // RIGHT: Title
    s.addText(title, {
      ...L.rightTitle, fontFace: "Inter", fontSize: 20, bold: true, color: brand.text, align: "left",
    } as any);

    // RIGHT: Code/SKU (hyperlink to page/spec if present)
    const skuText = code || (p.product ?? p.name ?? "");
    if (skuText) {
      s.addText(
        [{
          text: skuText,
          options: {
            hyperlink: url ? { url: String(url) } : undefined,
            color: brand.accent,
            underline: { style: "heavy" },
            fontSize: 14,
          },
        }],
        { ...L.rightSku, fontFace: "Inter", fontSize: 14, align: "left" } as any
      );
    }

    // RIGHT: Specs table (zebra)
    const pairs = toSpecPairs(p);
    if (pairs.length) {
      const rows = pairs.map(([label, value], i) => ([
        { text: label || "", options: { bold: true, fontSize: 12, fill: { color: i % 2 ? "FFFFFF" : "F8FAFC" } } },
        { text: value || "", options: { fontSize: 12, fill: { color: i % 2 ? "FFFFFF" : "F8FAFC" } } },
      ]));
      s.addTable(rows as any, {
        x: L.rightPane.x, y: L.rightTableY, w: L.rightPane.w, colW: [1.5, 2.1],
        border: { style: "none" }, margin: 0.04,
      } as any);
    } else if (url) {
      // If no structured specs, try to thumbnail the PDF
      const specThumb = await pdfFirstPageToPng(p.pdfUrl || p.specPdfUrl);
      if (specThumb) {
        s.addImage({
          data: specThumb, x: L.rightPane.x, y: L.rightTableY, w: L.rightPane.w, h: 2.2,
          sizing: { type: "contain", w: L.rightPane.w, h: 2.2 },
        } as any);
      }
    }

    // DESCRIPTION (centered)
    if (p.description) {
      s.addText(p.description, {
        ...L.descBox, align: "center", fontFace: "Inter", fontSize: 13, color: "344054", fit: "shrink",
      } as any);
    }

    // Bottom bar + code (kept within slide)
    s.addShape(pptx.ShapeType.rect, {
      ...L.bottomBar, fill: { color: brand.bar }, line: { color: brand.bar },
    } as any);
    if (code) {
      s.addText(code, { ...L.codeText, fontFace: "Inter", fontSize: 12, color: "111111" } as any);
    }
  }

  await pptx.writeFile({ fileName: "Product-Presentation.pptx" } as any);
}

export const exportPptx = exportSelectionToPptx;
