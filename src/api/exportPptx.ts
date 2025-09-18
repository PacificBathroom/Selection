// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as pdfjsLib from "pdfjs-dist";
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

const PROXY = (u: string) => `/api/pdf-proxy?url=${encodeURIComponent(u)}`;

// helper builds data: URL from proxy/origin (handles images & pdf-as-image)
async function fetchAsDataUrl(url?: string): Promise<string | undefined> {
  try {
    if (!url) return undefined;

    // Prefer the proxy (returns raw bytes to the browser)
    const res = await fetch(PROXY(url));
    if (!res.ok) return undefined;

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const blob = await res.blob();

    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(`data:${contentType};base64,${String(reader.result).split(",")[1]}`);
      reader.readAsDataURL(blob);
    });
  } catch {
    // Fallback: try direct CORS fetch
    try {
      const res = await fetch(url!, { mode: "cors" });
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
}

// Use proxy for pdf.js as a URL (it returns real bytes)
async function pdfFirstPageToPng(pdfUrl?: string): Promise<string | undefined> {
  try {
    if (!pdfUrl) return undefined;
    const doc = await (pdfjsLib as any).getDocument({ url: PROXY(pdfUrl), useSystemFonts: true }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1.35 }); // a bit smaller to fit
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d"); if (!ctx) return undefined;
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/png");
  } catch {
    // final fallback: embed the PDF as an image if server returns an image
    return fetchAsDataUrl(pdfUrl);
  }
}


function toSpecPairs(p: Product): Array<[string, string]> {
  // supports p.specs (array of {label,value}) or p.specifications (string "Label: Value | ...")
  const rows: Array<[string, string]> = [];
  if (Array.isArray(p.specs)) {
    for (const it of p.specs) {
      const label = String(it?.label ?? "").trim();
      const value = String(it?.value ?? "").trim();
      if (label || value) rows.push([label, value]);
    }
  } else if (typeof p.specifications === "string") {
    const parts = p.specifications.split(/\r?\n|\|/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const m = part.match(/^(.+?)\s*[:\-–]\s*(.+)$/);
      if (m) rows.push([m[1].trim(), m[2].trim()]);
      else rows.push(["", part]);
    }
  }
  // cap to ~10 rows to fit area
  return rows.slice(0, 10);
}

export async function exportSelectionToPptx(products: Product[], client: ClientInfo) {
  const pptx = new PptxGenJS();
  pptx.title = client.projectName || "Product Presentation";
  pptx.layout = "LAYOUT_16x9";

  const brand = {
    bg: "FFFFFF",
    text: "0F172A",      // slate-900
    accent: "1E6BD7",   // blue link
    faint: "F1F5F9",    // slate-100
    bar: "0EA5E9",      // bottom bar (cyan-ish)
    tableRow: ["F8FAFC", "FFFFFF"], // zebra
  };

  // Cover
  {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };
    s.addText(client.projectName || "Project Selection", {
      x: 0.8, y: 1.4, w: 8.5, h: 1, fontFace: "Inter", fontSize: 40, bold: true, color: brand.text,
    } as any);
    if (client.clientName)
      s.addText(`Client: ${client.clientName}`, {
        x: 0.8, y: 2.4, w: 8.5, h: 0.6, fontFace: "Inter", fontSize: 20, color: brand.text,
      } as any);
    if (client.dateISO)
      s.addText(client.dateISO, {
        x: 0.8, y: 3.0, w: 8.5, h: 0.5, fontFace: "Inter", fontSize: 14, color: "666666",
      } as any);
  }

  // Layout constants (16:9 slide is ~10in x 5.625in)
  const L = {
    leftImg: { x: 0.6, y: 1.1, w: 5.2, h: 3.9 },
    rightPane: { x: 6.1, y: 1.1, w: 3.7, h: 4.0 },
    rightTitle: { x: 6.1, y: 1.1, w: 3.7, h: 0.7 },
    rightSku: { x: 6.1, y: 1.8, w: 3.7, h: 0.4 },
    rightTableY: 2.3,
    bottomBar: { x: 0, y: 5.1, w: 10, h: 0.5 },
    codeText: { x: 0.7, y: 4.7, w: 4.5, h: 0.4 },
  };

  for (const p of products) {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    const title = p.name || p.product || "Untitled Product";
    const code = p.code || p.sku || "";
    const url = (p as any).url || p.pdfUrl || p.specPdfUrl; // prefer page URL, else spec PDF
    const imgUrl = p.imageUrl || p.image || p.thumbnail;

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

    // RIGHT: SKU/code as hyperlink (if url), styled like your mock
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

    // RIGHT: Specs table
    const pairs = toSpecPairs(p);
    if (pairs.length) {
      const rows = pairs.map(([label, value], i) => ([
        { text: label || "", options: { bold: true, fontSize: 12, fill: { color: brand.tableRow[i % 2] } } },
        { text: value || "", options: { fontSize: 12, fill: { color: brand.tableRow[i % 2] } } },
      ]));
      s.addTable(rows as any, {
        x: L.rightPane.x, y: L.rightTableY, w: L.rightPane.w,
        colW: [1.6, 2.1],
        border: { style: "none" }, // no grid lines
        margin: 0.04,
      } as any);
    } else {
      // light placeholder if no specs
      s.addShape(pptx.ShapeType.roundRect, {
        x: L.rightPane.x, y: L.rightTableY, w: L.rightPane.w, h: L.rightPane.h - (L.rightTableY - L.rightPane.y),
        fill: { color: brand.faint }, line: { color: "E2E8F0", width: 1 },
      } as any);
    }

    // BOTTOM: bar + code at left
    s.addShape(pptx.ShapeType.rect, {
      ...L.bottomBar, fill: { color: brand.bar }, line: { color: brand.bar },
    } as any);

    if (code) {
      s.addText(code, {
        ...L.codeText, fontFace: "Inter", fontSize: 12, color: "111111",
      } as any);
    }
  }

  await pptx.writeFile({ fileName: "Product-Presentation.pptx" } as any);
}

export const exportPptx = exportSelectionToPptx;
