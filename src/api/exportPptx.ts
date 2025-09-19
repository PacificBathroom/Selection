// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// PDF.js worker (optional — used only for PDF thumbnails)
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as pdfjsLib from "pdfjs-dist";
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

// ---------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------

// Turn this off if your proxy struggles with some hosts (placeholders+links will be shown instead)
const SHOW_PDF_THUMBS = true;

// Use our Netlify function to fetch cross-origin assets
const PROXY = (u: string) => `/api/pdf-proxy?url=${encodeURIComponent(u)}`;

// ---------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const str = (v: unknown) => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
};
const ensureHttps = (u?: string) =>
  u?.startsWith("http://") ? u.replace(/^http:\/\//i, "https://") : u;

// IMAGE("...") extractor for Google Sheets
function extractUrlFromImageFormula(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^=*\s*image\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
}

// Case/space-insensitive getter with aliases (also unwraps IMAGE("..."))
function getField<T = unknown>(row: Record<string, any>, aliases: string[]): T | undefined {
  const want = aliases.map(norm);
  for (const k of Object.keys(row)) {
    const nk = norm(k);
    if (want.includes(nk)) {
      const raw = row[k];
      const img = extractUrlFromImageFormula(raw);
      return (img ?? raw) as T;
    }
  }
  return undefined;
}

// Promise helper: blob -> dataURL
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(blob);
  });
}

// Given ANY image URL, return a **PNG data URL** suitable for PptxGenJS.
// - Tries the proxy first (CORS-safe), then direct
// - Converts WEBP/GIF/etc. to PNG via <canvas>
// - Ignores non-image URLs (e.g. product pages)
async function fetchImageAsPngDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  const safe = ensureHttps(url)!;

  async function tryOnce(u: string): Promise<string | undefined> {
    const res = await fetch(u);
    if (!res.ok) return undefined;

    const blob = await res.blob();

    // If the server gave us HTML/others, bail (it’s not an image)
    if (blob.type && !blob.type.startsWith("image/")) return undefined;

    // Convert anything to PNG (including webp)
    const dataUrl = await blobToDataURL(blob);

    // If it's already png/jpeg, we could return it right away, but to be safe
    // and consistent, always re-encode as PNG (PptxGenJS is happiest with PNG/JPEG)
    return await new Promise<string | undefined>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(undefined);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png")); // <- guaranteed PNG header
        } catch {
          resolve(undefined);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = dataUrl; // same-origin (data:) so canvas is not tainted
    });
  }

  // Proxy, then direct
  try {
    const viaProxy = await tryOnce(PROXY(safe));
    if (viaProxy) return viaProxy;
  } catch {}
  try {
    return await tryOnce(safe);
  } catch {
    return undefined;
  }
}

// First page of a PDF -> PNG dataURL (via proxy). Falls back to undefined.
async function pdfFirstPageToPng(pdfUrl?: string): Promise<string | undefined> {
  if (!pdfUrl || !SHOW_PDF_THUMBS) return undefined;
  const url = ensureHttps(pdfUrl)!;
  try {
    const doc = await (pdfjsLib as any)
      .getDocument({ url: PROXY(url), useSystemFonts: true })
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
    return undefined;
  }
}

// Build spec pairs from a row
function toSpecPairs(row: Record<string, any>): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];

  if (Array.isArray((row as any).specs)) {
    for (const it of (row as any).specs as Array<{ label?: string; value?: string }>) {
      const label = String(it?.label ?? "").trim();
      const value = String(it?.value ?? "").trim();
      if (label || value) pairs.push([label, value]);
    }
  }

  const long =
    str(getField(row, ["Specifications", "Specs", "Product Details", "Details", "Features"])) ||
    str((row as any).specifications) ||
    str((row as any).specs);

  if (!pairs.length && long) {
    for (const part of long.split(/\r?\n|[|•]/).map((s) => s.trim()).filter(Boolean)) {
      const m = part.match(/^(.+?)\s*[:\-–]\s*(.+)$/);
      if (m) pairs.push([m[1].trim(), m[2].trim()]);
      else pairs.push(["", part]);
      if (pairs.length >= 10) break;
    }
  }

  if (!pairs.length) {
    const SPECY = [
      "Material", "Finish", "Mounting", "Features", "Options", "Dimensions",
      "Size", "Capacity", "Power", "Model", "Warranty",
    ].map(norm);

    for (const key of Object.keys(row)) {
      const nk = norm(key);
      if (
        ["name","product","title","code","sku","image","imageurl","photo","thumbnail","url","link",
         "pdf","pdfurl","specpdfurl","description","desc"].includes(nk)
      ) continue;
      const val = String(row[key] ?? "").trim();
      if (!val) continue;
      if (SPECY.includes(nk) || val.length <= 120) {
        pairs.push([key.replace(/\s+/g, " ").trim(), val]);
      }
      if (pairs.length >= 10) break;
    }
  }

  return pairs.slice(0, 10);
}

// ---------------------------------------------------------------------
// PPT Export
// ---------------------------------------------------------------------

export async function exportSelectionToPptx(rows: Product[], client: ClientInfo) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = client.projectName || "Product Presentation";

  const brand = {
    bg: "FFFFFF",
    text: "0F172A",        // slate-900
    accent: "1E6BD7",      // link
    faint: "F1F5F9",       // slate-100
    bar: "45D6C6",         // footer bar (teal)
    zebra: ["F8FAFC", "FFFFFF"],
  };

  // Cover
  {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };
    s.addText(client.projectName || "Project Selection", {
      x: 0.5, y: 1.1, w: 9.0, h: 1.1,
      fontFace: "Inter", fontSize: 40, bold: true, color: brand.text, align: "center",
    } as any);
    const lines: string[] = [];
    if (client.clientName) lines.push(`Client: ${client.clientName}`);
    if (client.dateISO) lines.push(client.dateISO);
    if (lines.length) {
      s.addText(lines.join("  ·  "), {
        x: 0.5, y: 2.2, w: 9.0, h: 0.6,
        fontFace: "Inter", fontSize: 16, color: "666666", align: "center",
      } as any);
    }
  }

  // Layout constants
  const L = {
    img:       { x: 0.6, y: 1.2, w: 5.2, h: 3.8 },
    rightPane: { x: 6.1, y: 1.2, w: 3.5, h: 3.9 },
    title:     { x: 0.8, y: 0.6, w: 8.5, h: 0.7 },
    sku:       { x: 6.1, y: 1.8, w: 3.5, h: 0.4 },
    tableY:    2.25,
    desc:      { x: 0.7, y: 5.0, w: 8.6, h: 0.45 },
    bar:       { x: 0.0, y: 5.45, w: 10.0, h: 0.25 },
    barText:   { x: 0.6, y: 5.22, w: 8.8, h: 0.25 },
  };

  for (const row of rows as unknown as Record<string, any>[]) {
    // Resolve fields
    const title =
      str(getField(row, ["Name", "Product", "Title"])) ||
      str((row as any).name) ||
      str((row as any).product) ||
      "Untitled Product";

    const description =
      str(getField(row, ["Description", "Desc", "Summary"])) ||
      str((row as any).description) ||
      undefined;

    const code =
      str(getField(row, ["Code", "SKU", "Model", "Item", "Product Code"])) ||
      str((row as any).code) ||
      str((row as any).sku) ||
      undefined;

    const imageUrl =
      ensureHttps(
        str(getField(row, ["ImageURL","Image URL","Image","Photo","Thumbnail","Picture"])) ||
        str((row as any).imageUrl) ||
        str((row as any).image) ||
        str((row as any).thumbnail)
      );

    const pdfUrl =
      ensureHttps(
        str(getField(row, ["PDF URL","PdfURL","Spec PDF","Spec Sheet","Datasheet","Brochure","URL","Link"])) ||
        str((row as any).pdfUrl) ||
        str((row as any).specPdfUrl) ||
        str((row as any).url) ||
        str((row as any).link)
      );

    const specs = toSpecPairs(row);

    // Slide
    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    // Title (full width top, shrink if long)
    s.addText(title, {
      ...L.title,
      fontFace: "Inter", fontSize: 22, bold: true, color: brand.text, align: "center", fit: "shrink",
    } as any);

    // Left image
    let imgData: string | undefined;
    if (imageUrl && !/\/product\//i.test(imageUrl)) {
      imgData = await fetchImageAsPngDataUrl(imageUrl);
    }
    if (imgData) {
      s.addImage({ data: imgData, ...L.img, sizing: { type: "contain", w: L.img.w, h: L.img.h } } as any);
    } else {
      s.addShape(pptx.ShapeType.roundRect, {
        ...L.img, fill: { color: brand.faint }, line: { color: "D0D7E2", width: 1 },
      } as any);
    }

    // SKU (and link if pdf exists)
    if (code) {
      s.addText(
        [{ text: code, options: { hyperlink: pdfUrl ? { url: pdfUrl } : undefined, color: brand.accent, underline: true, fontSize: 14 } }],
        { ...L.sku, fontFace: "Inter", fontSize: 14, align: "left" } as any
      );
    }

    // Right side: specs table or PDF thumb or placeholder
    if (specs.length) {
      const rowsData = specs.map(([label, value], i) => ([
        { text: label || "", options: { bold: true, fontSize: 12, fill: { color: brand.zebra[i % 2] } } },
        { text: value || "", options: { fontSize: 12, fill: { color: brand.zebra[i % 2] } } },
      ]));
      s.addTable(rowsData as any, {
        x: L.rightPane.x, y: L.tableY, w: L.rightPane.w, colW: [1.5, 2.0],
        border: { style: "none" }, margin: 0.04,
      } as any);
    } else if (pdfUrl) {
      const thumb = await pdfFirstPageToPng(pdfUrl);
      if (thumb) {
        const h = L.rightPane.h - (L.tableY - L.rightPane.y);
        s.addImage({
          data: thumb, x: L.rightPane.x, y: L.tableY, w: L.rightPane.w, h,
          sizing: { type: "contain", w: L.rightPane.w, h },
        } as any);
      } else {
        s.addShape(pptx.ShapeType.roundRect, {
          x: L.rightPane.x, y: L.tableY, w: L.rightPane.w, h: L.rightPane.h - (L.tableY - L.rightPane.y),
          fill: { color: brand.faint }, line: { color: "E2E8F0", width: 1 },
        } as any);
        // Put a link to the PDF so there's still something actionable
        s.addText(
          [{ text: "View specs", options: { hyperlink: { url: pdfUrl }, color: brand.accent, underline: true, fontSize: 14 } }],
          { x: L.rightPane.x, y: L.tableY + 1.0, w: L.rightPane.w, h: 0.5, align: "center", fontFace: "Inter" } as any
        );
      }
    } else {
      s.addShape(pptx.ShapeType.roundRect, {
        x: L.rightPane.x, y: L.tableY, w: L.rightPane.w, h: L.rightPane.h - (L.tableY - L.rightPane.y),
        fill: { color: brand.faint }, line: { color: "E2E8F0", width: 1 },
      } as any);
    }

    // Description (shrink to fit)
    if (description) {
      s.addText(description, {
        ...L.desc, align: "center", fontFace: "Inter", fontSize: 13, color: "344054", fit: "shrink",
      } as any);
    }

    // Footer bar + (optionally) code
    s.addShape(pptx.ShapeType.rect, { ...L.bar, fill: { color: brand.bar }, line: { color: brand.bar } } as any);
    if (code) {
      s.addText(code, { ...L.barText, fontFace: "Inter", fontSize: 12, color: "0B3A33", align: "left" } as any);
    }
  }

  // Thank-you slide
  {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };
    s.addText("Thank you", {
      x: 0.8, y: 2.0, w: 8.5, h: 1,
      fontFace: "Inter", fontSize: 36, bold: true, color: brand.text, align: "center",
    } as any);
    const parts: string[] = [];
    if (client.contactName) parts.push(client.contactName);
    if (client.contactEmail) parts.push(client.contactEmail);
    if (client.contactPhone) parts.push(client.contactPhone);
    if (parts.length) {
      s.addText(parts.join("  ·  "), {
        x: 0.8, y: 3.2, w: 8.5, h: 0.8,
        fontFace: "Inter", fontSize: 16, color: "666666", align: "center",
      } as any);
    }
  }

  await pptx.writeFile({ fileName: "Product-Presentation.pptx" } as any);
}

// Alias expected by the rest of your app
export const exportPptx = exportSelectionToPptx;
