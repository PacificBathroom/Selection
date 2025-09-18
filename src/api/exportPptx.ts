// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// -------- PDF.js (one source of truth) --------
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as pdfjsLib from "pdfjs-dist";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

// Proxy helper (bypass CORS on images/PDFs)
const PROXY = (u: string) => `/api/pdf-proxy?url=${encodeURIComponent(u)}`;

// Convert a remote file to a data: URL via the proxy
async function fetchAsDataUrl(url?: string): Promise<string | undefined> {
  try {
    if (!url) return undefined;
    // Prefer the proxy (returns base64 body and preserves content-type)
    const res = await fetch(PROXY(url));
    if (!res.ok) return undefined;
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const b64 = await res.text(); // the proxy returns base64 body
    return `data:${contentType};base64,${b64}`;
  } catch {
    // Final fallback: direct fetch (may fail on CORS; safe to ignore)
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
}

async function pdfFirstPageToPng(pdfUrl?: string): Promise<string | undefined> {
  try {
    if (!pdfUrl) return undefined;

    // Use the proxy for pdf.js to avoid CORS
    const doc = await (pdfjsLib as any)
      .getDocument({ url: PROXY(pdfUrl), useSystemFonts: true })
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
    // If pdf.js fails (e.g., not a PDF or blocked), try to embed as image via proxy
    return fetchAsDataUrl(pdfUrl);
  }
}

export async function exportSelectionToPptx(products: Product[], client: ClientInfo) {
  const pptx = new PptxGenJS();
  pptx.title = client.projectName || "Product Presentation";
  pptx.layout = "LAYOUT_16x9";

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

  // Product slides
  for (const p of products) {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    const title = p.name || p.product || "Untitled Product";
    const desc = p.description || "";
    const code = p.code || p.sku || "";
    const contactName = client.contactName || p.contactName || "";

    // Title
    s.addText(title, {
      x: 0.7, y: 0.4, w: 8.6, h: 0.8,
      fontFace: "Inter", fontSize: 28, bold: true, color: brand.text,
    } as any);

    // Left image (product)
    const imgUrl = p.imageUrl || p.image || p.thumbnail;
    const imgData = await fetchAsDataUrl(imgUrl);
    if (imgData) {
      s.addImage({
        data: imgData, x: 0.7, y: 1.2, w: 4.5, h: 3.4,
        sizing: { type: "contain", w: 4.5, h: 3.4 },
      } as any);
    } else {
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.7, y: 1.2, w: 4.5, h: 3.4,
        fill: { color: brand.faint },
        line: { color: "DDDDDD", width: 1 },
      } as any);
      s.addText("Image", {
        x: 0.7, y: 2.7, w: 4.5, h: 0.5,
        align: "center", fontFace: "Inter", fontSize: 16, color: "888888",
      } as any);
    }

    // Right specs (PDF thumbnail or link)
    const pdfUrl = p.pdfUrl || p.specPdfUrl;
    let specThumb = await pdfFirstPageToPng(pdfUrl);

    if (specThumb) {
      s.addImage({
        data: specThumb, x: 5.5, y: 1.2, w: 4.5, h: 3.4,
        sizing: { type: "contain", w: 4.5, h: 3.4 },
      } as any);
    } else {
      s.addShape(pptx.ShapeType.roundRect, {
        x: 5.5, y: 1.2, w: 4.5, h: 3.4,
        fill: { color: brand.faint },
        line: { color: "DDDDDD", width: 1 },
      } as any);
      if (pdfUrl) {
        s.addText(
          [{
            text: "View Specs",
            options: {
              hyperlink: { url: String(pdfUrl) },
              color: brand.accent,
              underline: { style: "heavy" }, // typed underline (no boolean)
              fontSize: 16,
            },
          }],
          { x: 5.5, y: 2.7, w: 4.5, h: 0.5, align: "center", fontFace: "Inter", fontSize: 16 } as any
        );
      } else {
        s.addText("Specs", {
          x: 5.5, y: 2.7, w: 4.5, h: 0.5,
          align: "center", fontFace: "Inter", fontSize: 16, color: "888888",
        } as any);
      }
    }

    // Description (autoshrink)
    s.addText(desc, {
      x: 0.7, y: 4.8, w: 9.3, h: 1.4,
      fontFace: "Inter", fontSize: 14, color: "333333",
      fit: "shrink",
    } as any);

    // Bottom meta
    const metaY = 6.5;
    if (code) {
      s.addText(`Product code: ${code}`, {
        x: 0.7, y: metaY, w: 4.5, h: 0.4,
        fontFace: "Inter", fontSize: 12, color: "555555",
      } as any);
    }
    if (contactName) {
      s.addText(`Contact: ${contactName}`, {
        x: 5.5, y: metaY, w: 4.5, h: 0.4, align: "right",
        fontFace: "Inter", fontSize: 12, color: "555555",
      } as any);
    }
  }

  // Footer slide
  {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };
    s.addText("Thank you", {
      x: 0.8, y: 2.0, w: 8.5, h: 1,
      fontFace: "Inter", fontSize: 36, bold: true, color: brand.text,
    } as any);
    const lines: string[] = [];
    if (client.contactName) lines.push(client.contactName);
    if (client.contactEmail) lines.push(client.contactEmail);
    if (client.contactPhone) lines.push(client.contactPhone);
    s.addText(lines.join("  ·  "), {
      x: 0.8, y: 3.2, w: 8.5, h: 0.8,
      fontFace: "Inter", fontSize: 16, color: "666666",
    } as any);
  }

  await pptx.writeFile({ fileName: "Product-Presentation.pptx" } as any);
}

// alias for older imports
export const exportPptx = exportSelectionToPptx;
