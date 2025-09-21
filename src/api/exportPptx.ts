// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// PDF.js worker (only used for PDF thumbnails)
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as pdfjsLib from "pdfjs-dist";
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

// -------------------------------------------------------------
// Settings
// -------------------------------------------------------------
const SHOW_PDF_THUMBS = true; // set false if your proxy has trouble with PDFs
const PROXY = (u: string) => `/api/pdf-proxy?url=${encodeURIComponent(u)}`;

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const str = (v: unknown) => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
};

// Extract URL from =IMAGE("https://…") used in Google Sheets
function extractUrlFromImageFormula(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^=*\s*image\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
}

// Case/space-insensitive getter with aliases (unwraps IMAGE())
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

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(blob);
  });
}

// Try proxy with ORIGINAL url first (so http-only hosts work), then direct https.
async function fetchImageAsPngDataUrl(originalUrl?: string): Promise<string | undefined> {
  if (!originalUrl) return undefined;

  async function toPng(dataUrl: string): Promise<string | undefined> {
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
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(undefined);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = dataUrl;
    });
  }

  async function tryFetch(u: string): Promise<string | undefined> {
    const res = await fetch(u);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    if (blob.type && !blob.type.startsWith("image/")) return undefined; // ignore HTML, etc.
    const dataUrl = await blobToDataURL(blob);
    return toPng(dataUrl);
  }

  // 1) Proxy original URL (works for http + CORS)
  try {
    const viaProxy = await tryFetch(PROXY(originalUrl));
    if (viaProxy) return viaProxy;
  } catch {}

  // 2) Direct HTTPS if the source supports it
  try {
    const https = originalUrl.replace(/^http:\/\//i, "https://");
    if (/^https:\/\//i.test(https)) {
      const direct = await tryFetch(https);
      if (direct) return direct;
    }
  } catch {}

  return undefined;
}

// First page of a PDF -> PNG data URL (through proxy). Falls back to undefined.
async function pdfFirstPageToPng(pdfUrl?: string): Promise<string | undefined> {
  if (!pdfUrl || !SHOW_PDF_THUMBS) return undefined;
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
    return undefined;
  }
}

// Build up to 12 spec rows from various shapes of input
function toSpecPairs(row: Record<string, any>): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];

  // Array form: [{label, value}]
  if (Array.isArray((row as any).specs)) {
    for (const it of (row as any).specs as Array<{ label?: string; value?: string }>) {
      const label = String(it?.label ?? "").trim();
      const value = String(it?.value ?? "").trim();
      if (label || value) pairs.push([label, value]);
    }
  }

  // Long text form
  const long =
    str(getField(row, ["Specifications", "Specs", "Product Details", "Details", "Features", "Notes"])) ||
    str((row as any).specifications) ||
    str((row as any).specs);

  if (!pairs.length && long) {
    for (const part of long.split(/\r?\n|[|•]/).map((s) => s.trim()).filter(Boolean)) {
      const m = part.match(/^(.+?)\s*[:\-–]\s*(.+)$/);
      if (m) pairs.push([m[1].trim(), m[2].trim()]);
      else pairs.push(["", part]);
      if (pairs.length >= 12) break;
    }
  }

  // Header/value columns (fallback)
  if (!pairs.length) {
    const SPECY = [
      "Material", "Finish", "Mounting", "Features", "Options", "Dimensions",
      "Size", "Capacity", "Power", "Model", "Warranty", "Colour", "Color",
    ].map(norm);

    for (const key of Object.keys(row)) {
      const nk = norm(key);
      if (
        [
          "name","product","title","code","sku","image","imageurl","photo","thumbnail","picture","imagelink","mainimage",
          "url","link","pdf","pdfurl","specpdfurl","datasheet","brochure",
          "description","desc","shortdescription","longdescription",
        ].includes(nk)
      ) {
        continue;
      }

      const val = String(row[key] ?? "").trim();
      if (!val) continue;

      if (SPECY.includes(nk) || val.length <= 120) {
        pairs.push([key.replace(/\s+/g, " ").trim(), val]);
      }
      if (pairs.length >= 12) break;
    }
  }

  return pairs.slice(0, 12);
}

// -------------------------------------------------------------
// PPT Export
// -------------------------------------------------------------
export async function exportSelectionToPptx(rows: Product[], client: ClientInfo) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = client.projectName || "Product Presentation";

  const brand = {
    bg: "FFFFFF",
    text: "0F172A",    // slate-900
    accent: "1E6BD7",  // link blue
    faint: "F1F5F9",   // slate-100
    bar: "24D3EE",     // footer bar
    zebra: ["F8FAFC", "FFFFFF"],
  };

  // Cover
  {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };
    s.addText(client.projectName || "Project Selection", {
      x: 0.4, y: 1.0, w: 9.2, h: 1.1,
      fontFace: "Inter", fontSize: 40, bold: true, color: brand.text, align: "center",
    } as any);
    const lines: string[] = [];
    if (client.clientName) lines.push(`Client: ${client.clientName}`);
    if (client.dateISO) lines.push(client.dateISO);
    if (lines.length) {
      s.addText(lines.join("  ·  "), {
        x: 0.4, y: 2.2, w: 9.2, h: 0.6,
        fontFace: "Inter", fontSize: 16, color: "666666", align: "center",
      } as any);
    }
  }

  // Layout (16x9 height ≈ 5.63")
  const L = {
    title:     { x: 0.5, y: 0.5, w: 9.0, h: 0.7 },
    img:       { x: 0.5, y: 1.0, w: 5.2, h: 3.7 },
    rightPane: { x: 6.0, y: 1.0, w: 3.5, h: 3.9 },
    sku:       { x: 6.0, y: 1.6, w: 3.5, h: 0.4 },
    tableY:    2.1,
    desc:      { x: 0.6, y: 4.8, w: 8.8, h: 0.48 },
    bar:       { x: 0.0, y: 5.30, w: 10.0, h: 0.30 },
    barText:   { x: 0.6, y: 5.04, w: 8.8, h: 0.25 },
  };

  for (const row of rows as unknown as Record<string, any>[]) {
    // Resolve row fields (accepts lots of header variations, incl. IMAGE())
    const title =
      str(getField(row, ["Name", "Product", "Title"])) ||
      str((row as any).name) ||
      str((row as any).product) ||
      "Untitled Product";

    const description =
      str(getField(row, ["Description", "Desc", "Summary", "Long Description", "Short Description"])) ||
      str((row as any).description) ||
      str((row as any).longDescription) ||
      str((row as any).shortDescription) ||
      undefined;

    const code =
      str(getField(row, ["Code", "SKU", "Model", "Item", "Product Code"])) ||
      str((row as any).code) ||
      str((row as any).sku) ||
      undefined;

    const imageUrl =
      str(getField(row, ["ImageURL","Image URL","Image","Photo","Thumbnail","Picture","Image Link","Main Image"])) ||
      str((row as any).imageUrl) ||
      str((row as any).image) ||
      str((row as any).thumbnail);

    const pdfUrl =
      str(getField(row, ["PDF URL","PdfURL","Spec PDF","Spec Sheet","Datasheet","Brochure","URL","Link"])) ||
      str((row as any).pdfUrl) ||
      str((row as any).specPdfUrl) ||
      str((row as any).url) ||
      str((row as any).link);

    const specs = toSpecPairs(row);

    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    // Title
    s.addText(title, {
      ...L.title,
      fontFace: "Inter", fontSize: 22, bold: true, color: brand.text, align: "center", fit: "shrink",
    } as any);

    // Left image (proxy fetch -> data URL -> re-encode as PNG)
    const imgData = await fetchImageAsPngDataUrl(imageUrl);
    if (imgData) {
      s.addImage({ data: imgData, ...L.img, sizing: { type: "contain", w: L.img.w, h: L.img.h } } as any);
    } else {
      s.addShape(pptx.ShapeType.roundRect, {
        ...L.img, fill: { color: brand.faint }, line: { color: "D0D7E2", width: 1 },
      } as any);
    }

    // Code/SKU (hyperlink to PDF if present)
    if (code) {
      s.addText(
        [
          {
            text: code,
            options: {
              hyperlink: pdfUrl ? { url: pdfUrl } : undefined,
              color: brand.accent,
              underline: { style: "sng" }, // correct typing for pptxgenjs
              fontSize: 14,
            },
          },
        ] as any,
        { ...L.sku, fontFace: "Inter", fontSize: 14, align: "left" } as any
      );
    }

    // Right side: specs table → or PDF thumbnail → or placeholder+link
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
        s.addText(
          [
            {
              text: "View specs",
              options: {
                hyperlink: { url: pdfUrl },
                color: brand.accent,
                underline: { style: "sng" },
                fontSize: 14,
              },
            },
          ] as any,
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

    // Footer bar + code again
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
      x: 0.8, y: 2.0, w: 8.5, h: 1, fontFace: "Inter", fontSize: 36, bold: true, color: brand.text, align: "center",
    } as any);
    const parts: string[] = [];
    if (client.contactName) parts.push(client.contactName);
    if (client.contactEmail) parts.push(client.contactEmail);
    if (client.contactPhone) parts.push(client.contactPhone);
    if (parts.length) {
      s.addText(parts.join("  ·  "), {
        x: 0.8, y: 3.2, w: 8.5, h: 0.8, fontFace: "Inter", fontSize: 16, color: "666666", align: "center",
      } as any);
    }
  }

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` } as any);
}

// Alias used elsewhere
export const exportPptx = exportSelectionToPptx;