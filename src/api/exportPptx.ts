// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// ------------------------------------------------------------------
// Proxy for remote files (must exist as a Netlify function you added)
// ------------------------------------------------------------------
const PROXY = (u: string) => `/api/file-proxy?url=${encodeURIComponent(u)}`;

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const str = (v: unknown) => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
};
const ensureHttps = (u?: string) =>
  u?.startsWith("http://") ? u.replace(/^http:\/\//i, "https://") : u;

// =IMAGE("https://…") → "https://…"
function extractUrlFromImageFormula(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^=*\s*image\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
}

// Preference-based getter (case/space-insensitive, unwraps IMAGE()).
function getField<T = unknown>(row: Record<string, any>, aliases: string[]): T | undefined {
  const want = aliases.map(norm);
  for (const k of Object.keys(row)) {
    if (want.includes(norm(k))) {
      const raw = row[k];
      const img = extractUrlFromImageFormula(raw);
      return (img ?? raw) as T;
    }
  }
  return undefined;
}

// Robust autodetection across *any* column:
function findFirstUrl(row: Record<string, any>, pred: (u: string) => boolean): string | undefined {
  for (const [_, v] of Object.entries(row)) {
    const raw = extractUrlFromImageFormula(v) ?? (typeof v === "string" ? v : undefined);
    if (!raw) continue;
    const m = raw.match(/https?:\/\/[^\s")]+/i);
    if (!m) continue;
    const u = ensureHttps(m[0])!;
    if (pred(u)) return u;
  }
  return undefined;
}
const looksImage = (u: string) => /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(u) || /image=|img=|\/images?\//i.test(u);
const looksPdf   = (u: string) => /\.pdf(\?|$)/i.test(u) || /\/pdfs?\//i.test(u);

// Server-proxied fetch → DataURL (no canvas, fewer failure points)
async function fetchViaProxyAsDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  const safe = ensureHttps(url)!;
  try {
    const res = await fetch(PROXY(safe));
    if (!res.ok) return undefined;
    const blob = await res.blob();
    if (blob.type && !blob.type.startsWith("image/")) return undefined;
    const fr = new FileReader();
    return await new Promise<string>((resolve) => {
      fr.onload = () => resolve(String(fr.result));
      fr.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

// Build specs from a variety of shapes
function toSpecPairs(row: Record<string, any>): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];

  // 1) Long “specifications”/“features” field split into rows
  const long =
    str(getField(row, ["Specifications","Specs","Product Details","Details","Features"])) ||
    str((row as any).specifications) ||
    str((row as any).specs);

  if (long) {
    for (const part of long.split(/\r?\n|[|•]/).map((s) => s.trim()).filter(Boolean)) {
      const m = part.match(/^(.+?)\s*[:\-–]\s*(.+)$/);
      if (m) pairs.push([m[1].trim(), m[2].trim()]);
      else pairs.push(["", part]);
      if (pairs.length >= 14) return pairs;
    }
  }

  // 2) Array form: [{label, value}]
  if (Array.isArray((row as any).specs)) {
    for (const it of (row as any).specs as Array<{label?: string; value?: string}>) {
      const label = String(it?.label ?? "").trim();
      const value = String(it?.value ?? "").trim();
      if (label || value) pairs.push([label, value]);
      if (pairs.length >= 14) return pairs;
    }
  }

  // 3) Any short-ish columns become rows, excluding obvious non-specs
  const EXCLUDE = new Set([
    "name","product","title","code","sku","image","imageurl","photo","thumbnail",
    "url","link","pdf","pdfurl","specpdfurl","description","desc","notes","comments",
    "category","price","cost","qty","quantity","supplier","brand"
  ]);
  for (const [key, raw] of Object.entries(row)) {
    const nk = norm(key);
    if (EXCLUDE.has(nk)) continue;
    const val = String(raw ?? "").trim();
    if (!val) continue;
    if (val.length <= 180) pairs.push([key.replace(/\s+/g, " ").trim(), val]);
    if (pairs.length >= 14) break;
  }

  return pairs;
}

// Pick a description even if header names don't match (choose the longest reasonable text)
function pickDescription(row: Record<string, any>): string | undefined {
  const preferred =
    str(getField(row, ["Description","Desc","Summary","Notes","Comments","Long Description","Short Description"])) ||
    str((row as any).description) ||
    str((row as any).notes) ||
    str((row as any).comments);
  if (preferred) return preferred;

  let best: string | undefined;
  for (const v of Object.values(row)) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (s.length >= 40 && s.length <= 600 && /\s/.test(s)) {
      if (!best || s.length > best.length) best = s;
    }
  }
  return best;
}

// ------------------------------------------------------------------
// PPT Export
// ------------------------------------------------------------------
export async function exportSelectionToPptx(rows: Product[], client: ClientInfo) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = client.projectName || "Product Presentation";

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

  // Slide layout
  const L = {
    title:     { x: 0.5, y: 0.5, w: 9.0, h: 0.7 },
    img:       { x: 0.5, y: 1.0, w: 5.2, h: 3.7 },
    rightPane: { x: 6.0, y: 1.0, w: 3.5, h: 3.9 },
    sku:       { x: 6.0, y: 1.6, w: 3.5, h: 0.45 },
    tableY:    2.1,
    desc:      { x: 0.6, y: 4.7, w: 8.8, h: 0.62 }, // slightly higher to avoid viewer clipping
    bar:       { x: 0.0, y: 5.18, w: 10.0, h: 0.32 }, // moved up a bit for mobile PPT viewers
    barText:   { x: 0.6, y: 4.94, w: 8.8, h: 0.25 },
  };

  for (const row of rows as unknown as Record<string, any>[]) {
    const title =
      str(getField(row, ["Name","Product","Title"])) ||
      str((row as any).name) ||
      str((row as any).product) ||
      "Untitled Product";

    const code =
      str(getField(row, ["Code","SKU","Model","Item","Product Code"])) ||
      str((row as any).code) ||
      str((row as any).sku) ||
      undefined;

    // Image/PDF/Description with *autodetection* fallbacks
    const imageUrl =
      ensureHttps(
        str(getField(row, ["ImageURL","Image URL","Image","Photo","Thumbnail","Picture"])) ||
        str((row as any).imageUrl) ||
        str((row as any).image) ||
        str((row as any).thumbnail)
      ) || findFirstUrl(row, looksImage);

    const pdfUrl =
      ensureHttps(
        str(getField(row, ["PDF","PDF URL","PdfURL","Spec PDF","Spec Sheet","Datasheet","Brochure","URL","Link"])) ||
        str((row as any).pdfUrl) ||
        str((row as any).specPdfUrl) ||
        str((row as any).url) ||
        str((row as any).link)
      ) || findFirstUrl(row, looksPdf);

    const description = pickDescription(row);
    const specs = toSpecPairs(row);

    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    // Title
    s.addText(title, {
      ...L.title,
      fontFace: "Inter", fontSize: 22, bold: true, color: brand.text, align: "center", fit: "shrink",
    } as any);

    // Left image (via proxy)
    let imgData: string | undefined;
    if (imageUrl && !/\/product\//i.test(imageUrl)) {
      imgData = await fetchViaProxyAsDataUrl(imageUrl);
    }
    if (imgData) {
      s.addImage({ data: imgData, ...L.img, sizing: { type: "contain", w: L.img.w, h: L.img.h } } as any);
    } else {
      s.addShape(pptx.ShapeType.roundRect, {
        ...L.img, fill: { color: brand.faint }, line: { color: "D0D7E2", width: 1 },
      } as any);
    }

    // SKU/Code (linked to PDF)
    if (code) {
      s.addText(
        [{ text: code, options: {
          hyperlink: pdfUrl ? { url: pdfUrl } : undefined,
          color: brand.accent,
          underline: { style: "sng" },
          fontSize: 14,
        }}],
        { ...L.sku, fontFace: "Inter", fontSize: 14, align: "left" } as any
      );
    }

    // Right pane: specs table or link placeholder
    if (specs.length) {
      const rowsData = specs.map(([label, value], i) => ([
        { text: label || "", options: { bold: true, fontSize: 12, fill: { color: brand.zebra[i % 2] } } },
        { text: value || "", options: { fontSize: 12, fill: { color: brand.zebra[i % 2] } } },
      ]));
      s.addTable(rowsData as any, {
        x: L.rightPane.x, y: L.tableY, w: L.rightPane.w, colW: [1.6, 1.9],
        border: { style: "none" }, margin: 0.04,
      } as any);
    } else {
      s.addShape(pptx.ShapeType.roundRect, {
        x: L.rightPane.x, y: L.tableY, w: L.rightPane.w, h: L.rightPane.h - (L.tableY - L.rightPane.y),
        fill: { color: brand.faint }, line: { color: "E2E8F0", width: 1 },
      } as any);
      if (pdfUrl) {
        s.addText(
          [{ text: "View specs", options: {
            hyperlink: { url: pdfUrl },
            color: brand.accent,
            underline: { style: "sng" },
            fontSize: 14,
          }}],
          { x: L.rightPane.x, y: L.tableY + 1.0, w: L.rightPane.w, h: 0.5, align: "center", fontFace: "Inter" } as any
        );
      }
    }

    // Description
    if (description) {
      s.addText(description, {
        ...L.desc, align: "center", fontFace: "Inter", fontSize: 13, color: "344054", fit: "shrink",
      } as any);
    }

    // Footer bar + code (always drawn)
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

  await pptx.writeFile({ fileName: "Product-Presentation.pptx" } as any);
}

export const exportPptx = exportSelectionToPptx;