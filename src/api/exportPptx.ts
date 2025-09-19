// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// PDF.js single source of truth
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as pdfjsLib from "pdfjs-dist";
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

// Use Netlify proxy to bypass CORS for images / PDFs
const PROXY = (u: string) => `/api/pdf-proxy?url=${encodeURIComponent(u)}`;

/** Fetch a remote URL (via proxy first) and return a data: URL string. */
async function fetchAsDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;

  // Try proxy first
  try {
    const res = await fetch(PROXY(url));
    if (!res.ok) throw new Error("proxy fetch failed");
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.readAsDataURL(blob);
    });
  } catch {
    // Fallback to direct fetch (may hit CORS)
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) return undefined;
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  }
}

/** Render first page of a PDF to PNG data URL (uses proxy). */
async function pdfFirstPageToPng(pdfUrl?: string): Promise<string | undefined> {
  if (!pdfUrl) return undefined;
  try {
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
    // Final fallback: if server serves PDF as an image somehow, try embed
    return fetchAsDataUrl(pdfUrl);
  }
}

/** Normalize specs into [label, value] pairs (max ~10). */
function toSpecPairs(p: Product): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (Array.isArray((p as any).specs)) {
    for (const it of (p as any).specs as Array<{ label?: string; value?: string }>) {
      const label = String(it?.label ?? "").trim();
      const value = String(it?.value ?? "").trim();
      if (label || value) rows.push([label, value]);
    }
  } else if (typeof (p as any).specifications === "string") {
    const parts = (p as any).specifications
      .split(/\r?\n|\|/)
      .map((s: string) => s.trim())
      .filter(Boolean);
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
    text: "0F172A",      // slate-900
    accent: "1E6BD7",    // blue link
    faint: "F1F5F9",     // slate-100
    bar: "24D3EE",       // bottom bar
    zebra: ["F8FAFC", "FFFFFF"],
  };

  // Cover
  {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };
    s.addText(client.projectName || "Project Selection", {
      x: 0.8, y: 1.4, w: 8.5, h: 1,
      fontFace: "Inter", fontSize: 40, bold: true, color: brand.text,
    } as any);
    if (client.clientName) {
      s.addText(`Client: ${client.clientName}`, {
        x: 0.8, y: 2.4, w: 8.5, h: 0.6,
        fontFace: "Inter", fontSize: 20, color: brand.text,
      } as any);
    }
    if (client.dateISO) {
      s.addText(client.dateISO, {
        x: 0.8, y: 3.0, w: 8.5, h: 0.5,
        fontFace: "Inter", fontSize: 14, color: "666666",
      } as any);
    }
  }

  // Layout constants
  const L = {
    leftImg:   { x: 0.6, y: 1.0, w: 5.0, h: 3.6 },       // big photo left
    rightPane: { x: 6.0, y: 1.0, w: 3.6, h: 3.9 },       // right area overall
    rightTitle:{ x: 6.0, y: 1.0, w: 3.6, h: 0.7 },       // product title
    rightSku:  { x: 6.0, y: 1.7, w: 3.6, h: 0.4 },       // sku/code line
    rightTableY: 2.2,                                    // specs table top
    descBox:   { x: 0.6, y: 4.45, w: 9.0, h: 0.55 },     // description
    bottomBar: { x: 0.0, y: 5.30, w: 10.0, h: 0.23 },    // bottom bar
    codeText:  { x: 0.7, y: 5.05, w: 4.5, h: 0.25 },     // code above bar
  };

  // Product slides
  for (const p of products) {
    // Debug info to verify incoming data
    console.log("PPT item", {
      title: p.name || p.product,
      imageUrl: p.imageUrl || p.image || p.thumbnail,
      pdfUrl: p.pdfUrl || p.specPdfUrl,
      hasSpecsArray: Array.isArray((p as any).specs),
      specsCount: Array.isArray((p as any).specs) ? (p as any).specs.length : 0,
      specifications: (p as any).specifications?.slice?.(0, 80),
    });

    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    const title = p.name || p.product || "Untitled Product";
    const code = p.code || p.sku || "";
    const url = (p as any).url || p.pdfUrl || p.specPdfUrl; // page URL if present, else spec PDF
    const imgUrl = p.imageUrl || p.image || p.thumbnail;

    // LEFT: product image
    const imgData = await fetchAsDataUrl(imgUrl);
    if (imgData) {
      s.addImage({ data: imgData, ...L.leftImg, sizing: { type: "contain", w: L.leftImg.w, h: L.leftImg.h } } as any);
    } else {
      s.addShape(pptx.ShapeType.roundRect, {
        ...L.leftImg, fill: { color: brand.faint }, line: { color: "D0D7E2", width: 1 },
      } as any);
    }

    // RIGHT: title
    s.addText(title, {
      ...L.rightTitle,
      fontFace: "Inter", fontSize: 20, bold: true, color: brand.text, align: "left",
    } as any);

    // RIGHT: SKU/code line (hyperlink if we have a URL)
    const skuText = code || (p.product ?? p.name ?? "");
    if (skuText) {
      s.addText(
        [{
          text: skuText,
          options: {
            hyperlink: url ? { url: String(url) } : undefined,
            color: brand.accent,
            underline: { style: "heavy" }, // <-- FIXED: was 'true'
            fontSize: 14,
          },
        }],
        { ...L.rightSku, fontFace: "Inter", fontSize: 14, align: "left" } as any
      );
    }

    // RIGHT: specs table (zebra, no grid)
    const pairs = toSpecPairs(p);
    if (pairs.length) {
      const rows = pairs.map(([label, value], i) => ([
        { text: label || "", options: { bold: true, fontSize: 12, fill: { color: brand.zebra[i % 2] } } },
        { text: value || "", options: { fontSize: 12, fill: { color: brand.zebra[i % 2] } } },
      ]));
      s.addTable(rows as any, {
        x: L.rightPane.x,
        y: L.rightTableY,
        w: L.rightPane.w,
        colW: [1.6, 2.0],
        border: { style: "none" },
        margin: 0.04,
      } as any);
    } else if (p.pdfUrl || p.specPdfUrl) {
      // If no parsed specs but we do have a PDF, try a preview image
      const thumb = await pdfFirstPageToPng(p.pdfUrl || p.specPdfUrl);
      if (thumb) {
        s.addImage({
          data: thumb,
          x: L.rightPane.x,
          y: L.rightTableY,
          w: L.rightPane.w,
          h: L.rightPane.h - (L.rightTableY - L.rightPane.y),
          sizing: { type: "contain", w: L.rightPane.w, h: L.rightPane.h - (L.rightTableY - L.rightPane.y) },
        } as any);
      } else {
        // fallback placeholder + link
        s.addShape(pptx.ShapeType.roundRect, {
          x: L.rightPane.x,
          y: L.rightTableY,
          w: L.rightPane.w,
          h: L.rightPane.h - (L.rightTableY - L.rightPane.y),
          fill: { color: brand.faint }, line: { color: "E2E8F0", width: 1 },
        } as any);
        s.addText(
          [{
            text: "View specs",
            options: {
              hyperlink: { url: String(p.pdfUrl || p.specPdfUrl) },
              color: brand.accent,
              underline: { style: "heavy" }, // <-- FIXED: was 'true'
              fontSize: 14,
            },
          }],
          { x: L.rightPane.x, y: L.rightTableY + 1.0, w: L.rightPane.w, h: 0.5, align: "center", fontFace: "Inter" } as any
        );
      }
    } else {
      // no specs at all
      s.addShape(pptx.ShapeType.roundRect, {
        x: L.rightPane.x,
        y: L.rightTableY,
        w: L.rightPane.w,
        h: L.rightPane.h - (L.rightTableY - L.rightPane.y),
        fill: { color: brand.faint }, line: { color: "E2E8F0", width: 1 },
      } as any);
    }

    // DESCRIPTION (centered, auto-shrink)
    if (p.description) {
      s.addText(p.description, {
        ...L.descBox,
        align: "center",
        fontFace: "Inter", fontSize: 13, color: "344054",
        fit: "shrink",
      } as any);
    }

    // BOTTOM BAR + CODE
    s.addShape(pptx.ShapeType.rect, {
      ...L.bottomBar, fill: { color: brand.bar }, line: { color: brand.bar },
    } as any);
    if (code) {
      s.addText(code, {
        ...L.codeText, fontFace: "Inter", fontSize: 12, color: "111111",
      } as any);
    }
  }

  // Thank-you slide
  {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };
    s.addText("Thank you", {
      x: 0.8, y: 2.0, w: 8.5, h: 1,
      fontFace: "Inter", fontSize: 36, bold: true, color: brand.text,
    } as any);
    const parts: string[] = [];
    if (client.contactName) parts.push(client.contactName);
    if (client.contactEmail) parts.push(client.contactEmail);
    if (client.contactPhone) parts.push(client.contactPhone);
    if (parts.length) {
      s.addText(parts.join("  ·  "), {
        x: 0.8, y: 3.2, w: 8.5, h: 0.8,
        fontFace: "Inter", fontSize: 16, color: "666666",
      } as any);
    }
  }

  await pptx.writeFile({ fileName: "Product-Presentation.pptx" } as any);
}

// alias
export const exportPptx = exportSelectionToPptx;
