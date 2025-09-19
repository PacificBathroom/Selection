// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// PDF.js worker
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import * as pdfjsLib from "pdfjs-dist";
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

// Proxy (Netlify function) to bypass CORS
const PROXY = (u: string) => `/api/pdf-proxy?url=${encodeURIComponent(u)}`;

/* ------------------------------ helpers ------------------------------ */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// IMAGE("...") extractor for Google Sheets
function extractUrlFromImageFormula(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^=*\s*image\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
}

// Case/space-insensitive getter with aliases
function getField<T = unknown>(row: Record<string, any>, aliases: string[]): T | undefined {
  const want = aliases.map(norm);
  for (const k of Object.keys(row)) {
    const nk = norm(k);
    if (want.includes(nk)) {
      const raw = row[k];
      // unwrap Sheets IMAGE() formulas
      const img = extractUrlFromImageFormula(raw);
      return (img ?? raw) as T;
    }
  }
  return undefined;
}

// Convert any URL string-ish to a string or undefined
const str = (v: unknown) => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
};

// Fetch (via proxy, then direct) and return data: URL
async function fetchAsDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  const tryFetch = async (u: string) => {
    const res = await fetch(u);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.readAsDataURL(blob);
    });
  };
  try {
    const viaProxy = await tryFetch(PROXY(url));
    if (viaProxy) return viaProxy;
  } catch {}
  try {
    return await tryFetch(url);
  } catch {
    return undefined;
  }
}

// Render the first page of a PDF to a PNG (via proxy)
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
    // fallback (some servers may actually return an image)
    return fetchAsDataUrl(pdfUrl);
  }
}

/** Build spec pairs from:
 *  - row.specs (array of {label,value})
 *  - "Specifications" / "Specs" long string
 *  - otherwise, auto-collect spec-like columns (Material, Finish, Mounting, Features, etc.)
 */
function toSpecPairs(row: Record<string, any>): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];

  // 1) explicit array
  if (Array.isArray((row as any).specs)) {
    for (const it of (row as any).specs as Array<{ label?: string; value?: string }>) {
      const label = String(it?.label ?? "").trim();
      const value = String(it?.value ?? "").trim();
      if (label || value) pairs.push([label, value]);
    }
  }

  // 2) long string in one field
  const specStr =
    str(getField(row, ["Specifications", "Specs", "Product Details", "Details", "Features"])) ||
    str((row as any).specifications) ||
    str((row as any).specs);

  if (!pairs.length && specStr) {
    const parts = specStr.split(/\r?\n|[|•]/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      const m = part.match(/^(.+?)\s*[:\-–]\s*(.+)$/);
      if (m) pairs.push([m[1].trim(), m[2].trim()]);
      else pairs.push(["", part]);
      if (pairs.length >= 10) break;
    }
  }

  // 3) spec-like columns
  if (!pairs.length) {
    const SPECY = [
      "Material", "Finish", "Mounting", "Features", "Options", "Dimensions",
      "Size", "Capacity", "Power", "Model", "Warranty",
    ];
    for (const key of Object.keys(row)) {
      const nk = norm(key);
      // ignore obvious non-spec columns
      if (["name","product","title","code","sku","image","imageurl","photo","thumbnail","url","link","pdf","pdfurl","specpdfurl","description","desc"].includes(nk)) continue;
      // if looks like one of our known spec labels, or short content -> treat as spec
      const isKnown = SPECY.map(norm).includes(nk);
      const val = String(row[key] ?? "").trim();
      if (val && (isKnown || val.length <= 120)) {
        const label = key.replace(/\s+/g, " ").trim();
        pairs.push([label, val]);
      }
      if (pairs.length >= 10) break;
    }
  }

  return pairs.slice(0, 10);
}

/* ------------------------------ exporter ------------------------------ */

export async function exportSelectionToPptx(rows: Product[], client: ClientInfo) {
  const pptx = new PptxGenJS();
  pptx.title = client.projectName || "Product Presentation";
  pptx.layout = "LAYOUT_16x9";

  const brand = {
    bg: "FFFFFF",
    text: "0F172A",
    accent: "1E6BD7",
    faint: "F1F5F9",
    bar: "24D3EE",
    zebra: ["F8FAFC", "FFFFFF"],
  };

  // Cover
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

  // Layout
  const L = {
    leftImg:   { x: 0.6, y: 1.0, w: 5.0, h: 3.6 },
    rightPane: { x: 6.0, y: 1.0, w: 3.6, h: 3.9 },
    rightTitle:{ x: 6.0, y: 1.0, w: 3.6, h: 0.7 },
    rightSku:  { x: 6.0, y: 1.7, w: 3.6, h: 0.4 },
    rightTableY: 2.2,
    descBox:   { x: 0.6, y: 4.45, w: 9.0, h: 0.55 },
    bottomBar: { x: 0.0, y: 5.30, w: 10.0, h: 0.23 },
    codeText:  { x: 0.7, y: 5.05, w: 4.5, h: 0.25 },
  };

  for (const row of rows as unknown as Record<string, any>[]) {
    // Resolve fields using aliases
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
      str(getField(row, ["Image URL", "Image", "Photo", "Thumbnail", "Picture"])) ||
      str((row as any).imageUrl) ||
      str((row as any).image) ||
      str((row as any).thumbnail);

    const pdfUrl =
      str(getField(row, ["PDF URL", "Spec PDF", "Spec Sheet", "Datasheet", "Brochure", "URL", "Link"])) ||
      str((row as any).pdfUrl) ||
      str((row as any).specPdfUrl) ||
      str((row as any).url) ||
      str((row as any).link);

    const specs = toSpecPairs(row);

    console.log("PPT item", {
      title, imageUrl, pdfUrl, code,
      hasSpecsArray: Array.isArray((row as any).specs),
      specsCount: specs.length,
    });

    // Slide
    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    // Left image
    const imgData = await fetchAsDataUrl(imageUrl);
    if (imgData) {
      s.addImage({ data: imgData, ...L.leftImg, sizing: { type: "contain", w: L.leftImg.w, h: L.leftImg.h } } as any);
    } else {
      s.addShape(pptx.ShapeType.roundRect, {
        ...L.leftImg, fill: { color: brand.faint }, line: { color: "D0D7E2", width: 1 },
      } as any);
    }

    // Right title
    s.addText(title, {
      ...L.rightTitle, fontFace: "Inter", fontSize: 20, bold: true, color: brand.text, align: "left",
    } as any);

    // Right code line (hyperlink if we have a URL)
    if (code) {
      s.addText(
// Code line
[{ 
  text: code, 
  options: {
    hyperlink: pdfUrl ? { url: pdfUrl } : undefined,
    color: brand.accent,
    underline: { style: "sng" },   // ← was "heavy"
    fontSize: 14
  } 
}]

// “View specs” link
[{ 
  text: "View specs", 
  options: { 
    hyperlink: { url: pdfUrl! },
    color: brand.accent,
    underline: { style: "sng" },   // ← was "heavy"
    fontSize: 14 
  } 
}]

      );
    }

    // Specs area: table -> or PDF preview -> or placeholder
    if (specs.length) {
      const rowsData = specs.map(([label, value], i) => ([
        { text: label || "", options: { bold: true, fontSize: 12, fill: { color: brand.zebra[i % 2] } } },
        { text: value || "", options: { fontSize: 12, fill: { color: brand.zebra[i % 2] } } },
      ]));
      s.addTable(rowsData as any, {
        x: L.rightPane.x, y: L.rightTableY, w: L.rightPane.w, colW: [1.6, 2.0],
        border: { style: "none" }, margin: 0.04,
      } as any);
    } else if (pdfUrl) {
      const thumb = await pdfFirstPageToPng(pdfUrl);
      if (thumb) {
        const h = L.rightPane.h - (L.rightTableY - L.rightPane.y);
        s.addImage({
          data: thumb, x: L.rightPane.x, y: L.rightTableY, w: L.rightPane.w, h,
          sizing: { type: "contain", w: L.rightPane.w, h },
        } as any);
      } else {
        s.addShape(pptx.ShapeType.roundRect, {
          x: L.rightPane.x, y: L.rightTableY, w: L.rightPane.w, h: L.rightPane.h - (L.rightTableY - L.rightPane.y),
          fill: { color: brand.faint }, line: { color: "E2E8F0", width: 1 },
        } as any);
        s.addText(
          [{ text: "View specs", options: { hyperlink: { url: pdfUrl }, color: brand.accent, underline: { style: "heavy" }, fontSize: 14 } }],
          { x: L.rightPane.x, y: L.rightTableY + 1.0, w: L.rightPane.w, h: 0.5, align: "center", fontFace: "Inter" } as any
        );
      }
    } else {
      s.addShape(pptx.ShapeType.roundRect, {
        x: L.rightPane.x, y: L.rightTableY, w: L.rightPane.w, h: L.rightPane.h - (L.rightTableY - L.rightPane.y),
        fill: { color: brand.faint }, line: { color: "E2E8F0", width: 1 },
      } as any);
    }

    // Description
    if (description) {
      s.addText(description, {
        ...L.descBox, align: "center", fontFace: "Inter", fontSize: 13, color: "344054", fit: "shrink",
      } as any);
    }

    // Bottom bar + code
    s.addShape(pptx.ShapeType.rect, { ...L.bottomBar, fill: { color: brand.bar }, line: { color: brand.bar } } as any);
    if (code) {
      s.addText(code, { ...L.codeText, fontFace: "Inter", fontSize: 12, color: "111111" } as any);
    }
  }

  // Thank-you slide
  {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };
    s.addText("Thank you", {
      x: 0.8, y: 2.0, w: 8.5, h: 1, fontFace: "Inter", fontSize: 36, bold: true, color: brand.text,
    } as any);
    const parts: string[] = [];
    if (client.contactName) parts.push(client.contactName);
    if (client.contactEmail) parts.push(client.contactEmail);
    if (client.contactPhone) parts.push(client.contactPhone);
    if (parts.length) {
      s.addText(parts.join("  ·  "), {
        x: 0.8, y: 3.2, w: 8.5, h: 0.8, fontFace: "Inter", fontSize: 16, color: "666666",
      } as any);
    }
  }

  await pptx.writeFile({ fileName: "Product-Presentation.pptx" } as any);
}

export const exportPptx = exportSelectionToPptx;
