// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// -------------------------------------------------------------
// Settings
// -------------------------------------------------------------
const PROXY = (u: string) => `/api/file-proxy?url=${encodeURIComponent(u)}`;

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const str = (v: unknown) => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
};
const ensureHttps = (u?: string) =>
  u?.startsWith("http://") ? u.replace(/^http:\/\//i, "https://") : u;

// Google Sheets: =IMAGE("https://…") → extract URL
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

// Server-proxied fetch -> DataURL (no canvas; fewer failure points)
async function fetchViaProxyAsDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  const safe = ensureHttps(url)!;
  try {
    const res = await fetch(PROXY(safe));
    if (!res.ok) return undefined;
    const blob = await res.blob();
    // If the server returns non-image (e.g., HTML), pptxgenjs will fail; bail early.
    if (blob.type && !blob.type.startsWith("image/")) return undefined;

    const fr = new FileReader();
    const dataUrl: string = await new Promise((resolve) => {
      fr.onload = () => resolve(String(fr.result));
      fr.readAsDataURL(blob);
    });
    return dataUrl;
  } catch {
    return undefined;
  }
}

// Build up to 12 spec rows from whatever fields exist.
// Much more permissive: will pick any short-ish value for table display.
function toSpecPairs(row: Record<string, any>): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];

  const long =
    str(getField(row, ["Specifications","Specs","Product Details","Details","Features"])) ||
    str((row as any).specifications) ||
    str((row as any).specs);

  if (long) {
    for (const part of long.split(/\r?\n|[|•]/).map((s) => s.trim()).filter(Boolean)) {
      const m = part.match(/^(.+?)\s*[:\-–]\s*(.+)$/);
      if (m) pairs.push([m[1].trim(), m[2].trim()]);
      else pairs.push(["", part]);
      if (pairs.length >= 12) return pairs;
    }
  }

  const EXCLUDE = new Set([
    "name","product","title","code","sku","image","imageurl","photo","thumbnail",
    "url","link","pdf","pdfurl","specpdfurl","description","desc","notes","comments"
  ]);
  for (const key of Object.keys(row)) {
    const nk = norm(key);
    if (EXCLUDE.has(nk)) continue;
    const val = String(row[key] ?? "").trim();
    if (!val) continue;
    if (val.length <= 160) pairs.push([key.replace(/\s+/g, " ").trim(), val]);
    if (pairs.length >= 12) break;
  }

  return pairs;
}

// -------------------------------------------------------------
// PPT Export (simple & robust)
// -------------------------------------------------------------
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

  const L = {
    title:     { x: 0.5, y: 0.5, w: 9.0, h: 0.7 },
    img:       { x: 0.5, y: 1.0, w: 5.2, h: 3.7 },
    rightPane: { x: 6.0, y: 1.0, w: 3.5, h: 3.9 },
    sku:       { x: 6.0, y: 1.6, w: 3.5, h: 0.4 },
    tableY:    2.1,
    desc:      { x: 0.6, y: 4.8, w: 8.8, h: 0.6 },
    bar:       { x: 0.0, y: 5.33, w: 10.0, h: 0.30 },
    barText:   { x: 0.6, y: 5.06, w: 8.8, h: 0.25 },
  };

  for (const row of rows as unknown as Record<string, any>[]) {
    const title =
      str(getField(row, ["Name","Product","Title"])) ||
      str((row as any).name) ||
      str((row as any).product) ||
      "Untitled Product";

    const description =
      str(getField(row, ["Description","Desc","Summary","Notes","Comments","Long Description","Short Description"])) ||
      str((row as any).description) ||
      str((row as any).notes) ||
      str((row as any).comments) ||
      undefined;

    const code =
      str(getField(row, ["Code","SKU","Model","Item","Product Code"])) ||
      str((row as any).code) ||
      str((row as any).sku) ||
      undefined;

    const imageUrl = ensureHttps(
      str(getField(row, ["ImageURL","Image URL","Image","Photo","Thumbnail","Picture"])) ||
      str((row as any).imageUrl) ||
      str((row as any).image) ||
      str((row as any).thumbnail)
    );

    const pdfUrl = ensureHttps(
      str(getField(row, ["PDF","PDF URL","PdfURL","Spec PDF","Spec Sheet","Datasheet","Brochure","URL","Link"])) ||
      str((row as any).pdfUrl) ||
      str((row as any).specPdfUrl) ||
      str((row as any).url) ||
      str((row as any).link)
    );

    const specs = toSpecPairs(row);

    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    // Title
    s.addText(title, {
      ...L.title,
      fontFace: "Inter", fontSize: 22, bold: true, color: brand.text, align: "center", fit: "shrink",
    } as any);

    // Left image: proxy + dataURL (robust)
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

    // SKU/Code (link to PDF if present)
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
        x: L.rightPane.x, y: L.tableY, w: L.rightPane.w, colW: [1.5, 2.0],
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

  await pptx.writeFile({ fileName: "Product-Presentation.pptx" } as any);
}

export const exportPptx = exportSelectionToPptx;