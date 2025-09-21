// netlify/functions/export-pptx.ts
import type { Handler } from "@netlify/functions";
import PptxGenJS from "pptxgenjs";

// Loose shapes so we work with whatever your sheet sends
type Row = Record<string, unknown>;
type ClientInfo = {
  projectName?: string;
  clientName?: string;
  dateISO?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

// -----------------------------
// helpers
// -----------------------------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const str = (v: unknown) => (v == null ? undefined : String(v).trim() || undefined);
const ensureHttps = (u?: string) =>
  u?.startsWith("http://") ? u.replace(/^http:\/\//i, "https://") : u;

// unwrap =IMAGE("https://...") from Google Sheets
function extractUrlFromImageFormula(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  const m =
    t.match(/^=*\s*image\s*\(\s*"(.*?)"\s*(?:,.*)?\)\s*$/i) ||
    t.match(/^=*\s*image\s*\(\s*'(.*?)'\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
}

// case/space-insensitive lookup with IMAGE() unwrapping
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

// build up to 10 spec pairs from many shapes of input
function toSpecPairs(row: Record<string, any>): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];

  // explicit [{label,value}] array
  if (Array.isArray(row.specs)) {
    for (const it of row.specs as Array<{ label?: string; value?: string }>) {
      const label = String(it?.label ?? "").trim();
      const value = String(it?.value ?? "").trim();
      if (label || value) pairs.push([label, value]);
    }
  }

  // long “bullet list” fields
  const long =
    str(getField(row, [
      "Specifications", "Specs", "Product Details", "Details", "Features",
      "Product Information", "Overview", "Notes", "Description (Long)"
    ])) ||
    str((row as any).specifications) ||
    str((row as any).specs);

  if (!pairs.length && long) {
    for (const part of long.split(/\r?\n|[|•;]/).map((s) => s.trim()).filter(Boolean)) {
      const m = part.match(/^(.+?)\s*[:\-–]\s*(.+)$/);
      if (m) pairs.push([m[1].trim(), m[2].trim()]);
      else pairs.push(["", part]);
      if (pairs.length >= 10) break;
    }
  }

  // Spec 1..12 or Feature 1..12 columns
  if (!pairs.length) {
    for (let i = 1; i <= 12; i++) {
      const v =
        str(getField(row, [`Spec ${i}`, `Specs ${i}`, `Feature ${i}`, `Attribute ${i}`])) ??
        str((row as any)[`spec${i}`]) ??
        str((row as any)[`feature${i}`]);
      if (v) pairs.push(["", v]);
      if (pairs.length >= 10) break;
    }
  }

  // fall back to short columns (skip obvious non-specs)
  if (!pairs.length) {
    const skip = new Set([
      "name","product","title","code","sku","image","imageurl","photo","thumbnail","picture",
      "url","link","pdf","pdfurl","specpdfurl","description","desc","qty","quantity","price","cost"
    ]);
    for (const key of Object.keys(row)) {
      const nk = norm(key);
      if (skip.has(nk)) continue;
      const val = String(row[key] ?? "").trim();
      if (!val) continue;
      if (val.length <= 140) pairs.push([key.replace(/\s+/g, " ").trim(), val]);
      if (pairs.length >= 10) break;
    }
  }

  return pairs.slice(0, 10);
}

// server-side image fetch -> data URL (avoids CORS)
async function fetchImageDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  const safe = ensureHttps(url)!;
  try {
    const res = await fetch(safe, { redirect: "follow" });
    if (!res.ok) return undefined;
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    const ct = res.headers.get("content-type") || "";
    const ext =
      ct.includes("png") ? "png" :
      ct.includes("webp") ? "webp" :
      ct.includes("gif") ? "gif" :
      ct.includes("svg") ? "svg+xml" :
      "jpeg";
    return `data:image/${ext};base64,` + buf.toString("base64");
  } catch {
    return undefined;
  }
}

// -----------------------------
// Netlify handler
// -----------------------------
export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Use POST" };
  }

  let rows: Row[] = [];
  let client: ClientInfo = {};
  try {
    const p = JSON.parse(event.body || "{}");
    rows = Array.isArray(p?.rows) ? p.rows : [];
    client = (p?.client || {}) as ClientInfo;
  } catch {
    return { statusCode: 400, body: "Bad JSON" };
  }

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = client.projectName || "Product Presentation";

  const brand = {
    bg: "FFFFFF",
    text: "0F172A",
    accent: "1E6BD7",
    faint: "F1F5F9",
    bar: "24D3EE",
    zebra: ["F8FAFC", "FFFFFF"] as const,
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

  // Layout constants
  const L = {
    title:     { x: 0.5, y: 0.5, w: 9.0, h: 0.7 },
    img:       { x: 0.5, y: 1.0, w: 5.2, h: 3.7 },
    rightPane: { x: 6.0, y: 1.0, w: 3.5, h: 3.9 },
    sku:       { x: 6.0, y: 1.6, w: 3.5, h: 0.4 },
    tableY:    2.1,
    desc:      { x: 0.6, y: 4.8, w: 8.8, h: 0.5 },
    bar:       { x: 0.0, y: 5.33, w: 10.0, h: 0.30 },
    barText:   { x: 0.6, y: 5.06, w: 8.8, h: 0.25 },
  };

  for (const row of rows as Record<string, any>[]) {
    const title =
      str(getField(row, ["Name", "Product", "Title"])) ||
      str((row as any).name) ||
      str((row as any).product) ||
      "Untitled Product";

    const description =
      str(getField(row, ["Description", "Desc", "Summary", "Overview", "Notes"])) ||
      str((row as any).description) ||
      undefined;

    const code =
      str(getField(row, ["Code", "SKU", "Model", "Item", "Product Code"])) ||
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
      str(getField(row, ["PDF URL","PdfURL","Spec PDF","Spec Sheet","Datasheet","Brochure","URL","Link"])) ||
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

    // Product image (server-side fetch -> base64 data URL)
    const imgData = await fetchImageDataUrl(imageUrl);
    if (imgData) {
      s.addImage({ data: imgData, ...L.img, sizing: { type: "contain", w: L.img.w, h: L.img.h } } as any);
    } else {
      s.addShape(pptx.ShapeType.roundRect, {
        ...L.img, fill: { color: brand.faint }, line: { color: "D0D7E2", width: 1 },
      } as any);
    }

    // Code/SKU with link to PDF (if present)
    if (code) {
      s.addText(
        [{ text: code, options: { hyperlink: pdfUrl ? { url: pdfUrl } : undefined, color: brand.accent, underline: { style: "sng" }, fontSize: 14 } }],
        { ...L.sku, fontFace: "Inter", fontSize: 14, align: "left" } as any
      );
    }

    // Specs table, else placeholder + "View specs" link
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
          [{ text: "View specs", options: { hyperlink: { url: pdfUrl }, color: brand.accent, underline: { style: "sng" }, fontSize: 14 } }],
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

  // produce Node buffer and return as download
  const buf = await pptx.write("nodebuffer");
  const fname =
    (client.projectName?.replace(/[^\w\-]+/g, " ").trim() || "Project Selection") + ".pptx";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
    body: buf.toString("base64"),
    isBase64Encoded: true,
  };
};