// src/api/exportPptx.ts
console.log("[pptx] exporter version: 2025-09-21-a");
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";


// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------
const PROXY = (rawUrl: string) =>
  `/.netlify/functions/file-proxy?url=${encodeURIComponent(rawUrl)}`;

const DEBUG = true;
const dlog = (...a: any[]) => DEBUG && console.log("[pptx]", ...a);

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const str = (v: unknown) => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
};

// Extract URL from =IMAGE("https://…")
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

// Normalize common URL oddities from spreadsheets
function normalizeImageUrl(u?: string): string | undefined {
  if (!u) return undefined;
  let s = String(u).trim();
  s = s.replace(/^"+|"+$/g, "");   // strip wrapping quotes
  if (s.startsWith("//")) s = "https:" + s;
  s = s.replace(/\s/g, "%20");     // spaces → %20
  return s;
}

// Convert ANY browser data URL to PNG data URL (handles webp/gif/svg/etc.)
async function dataUrlToPngDataUrl(dataUrl: string): Promise<string> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 1;
        canvas.height = img.naturalHeight || img.height || 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png")); // always PNG after this
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
// e.g., src/components/ExportButton.tsx (or wherever you trigger it)
import { exportPptx } from "@/api/exportPptx"; // or "../api/exportPptx" if you don't use "@/"

async function handleExport(selectedRows: Product[], client: ClientInfo) {
  await exportPptx(selectedRows, client);
}

// Fetch via Netlify proxy → browser dataURL; coerce to PNG/JPEG if needed
async function fetchAsDataUrl(
  rawUrl?: string
): Promise<{ ok: boolean; dataUrl?: string; msg?: string }> {
  const url = normalizeImageUrl(rawUrl);
  if (!url) return { ok: false, msg: "no image url" };

  const res = await fetch(PROXY(url));
  if (!res.ok) return { ok: false, msg: `proxy ${res.status}` };

  let ct = (res.headers.get("content-type") || "").toLowerCase();
  const b64 = await res.text();

  if (!ct.startsWith("image/")) ct = "image/jpeg"; // coerce if unknown
  let dataUrl = `data:${ct};base64,${b64}`;

  // If not jpeg/png, convert to PNG (handles webp/gif/svg etc.)
  if (!(ct.startsWith("image/png") || ct.startsWith("image/jpeg"))) {
    dataUrl = await dataUrlToPngDataUrl(dataUrl);
  }
  return { ok: true, dataUrl };
}

// PptxGenJS wants 'image/<type>;base64,...' (no 'data:' prefix)
function toPptxBase64Header(dataUrl: string): string {
  let s = (dataUrl || "").trim();
  if (s.startsWith("data:")) s = s.slice(5); // strip 'data:'
  if (s.startsWith("application/octet-stream;base64,")) {
    s = "image/jpeg;base64," + s.split("base64,")[1];
  }
  return s;
}

/**
 * Build bullet lines from flexible shapes:
 *  - "SpecsBullets" | "Specifications" | "Features" etc (multi-line or | or •)
 *  - Array field "specs" of strings or {label,value}
 *  - Fallback: short key/value fields -> "Label: value"
 */
function toBulletLines(row: Record<string, any>): string[] {
  const lines: string[] = [];

  // 1) Array forms
  const anySpecs = (row as any).specs;
  if (Array.isArray(anySpecs)) {
    for (const it of anySpecs) {
      if (typeof it === "string") {
        const s = it.trim();
        if (s) lines.push(s);
      } else if (it && typeof it === "object") {
        const label = String((it as any).label ?? "").trim();
        const value = String((it as any).value ?? "").trim();
        const combo = [label, value].filter(Boolean).join(": ").trim();
        if (combo) lines.push(combo);
      }
    }
  }

  // 2) Long text forms
  const long =
    str(getField(row, ["SpecsBullets","Specifications","Specs","Product Details","Details","Features","Notes"])) ||
    str((row as any).specifications) ||
    str((row as any).specs) ||
    str((row as any).SpecsBullets);

  if (long) {
    for (const part of long.split(/\r?\n|[|•]/).map((s) => s.trim()).filter(Boolean)) {
      lines.push(part);
      if (lines.length >= 12) break;
    }
  }

  // 3) Short key/value fallback (skip obvious non-spec keys)
  if (!lines.length) {
    const SKIP = new Set(
      ["name","product","title","code","sku","image","imageurl","photo","thumbnail","url","link",
       "pdf","pdfurl","specpdfurl","description","desc","shortdescription","longdescription","specsbullets"]
      .map(norm)
    );
    for (const key of Object.keys(row)) {
      const nk = norm(key);
      if (SKIP.has(nk)) continue;
      const val = String(row[key] ?? "").trim();
      if (!val) continue;
      if (val.length <= 120) {
        lines.push(`${key.replace(/\s+/g, " ").trim()}: ${val}`);
      }
      if (lines.length >= 12) break;
    }
  }

  return lines.slice(0, 12);
}

// -----------------------------------------------------------------------------
// PPT Export (layout matches your example)
// -----------------------------------------------------------------------------
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

  // Layout (16x9 height ~5.63")
  const L = {
    title:   { x: 0.5, y: 0.5, w: 9.0, h: 0.7 },
    img:     { x: 0.5, y: 1.1, w: 5.2, h: 3.7 },  // image LEFT
    specs:   { x: 6.0, y: 1.1, w: 3.5, h: 3.9 },  // bullet list RIGHT
    desc:    { x: 0.6, y: 4.9, w: 8.8, h: 0.48 },
    bar:     { x: 0.0, y: 5.30, w: 10.0, h: 0.30 },
    barText: { x: 0.6, y: 5.04, w: 8.8, h: 0.25 },
  };

  for (const row of rows as unknown as Record<string, any>[]) {
    // Resolve fields
    const title =
      str(getField(row, ["Name","Product","Title"])) ||
      str((row as any).name) || str((row as any).product) || "Untitled Product";

    const description =
      str(getField(row, ["Description","Desc","Summary","Long Description","Short Description"])) ||
      str((row as any).description) || str((row as any).longDescription) || str((row as any).shortDescription);

    const code =
      str(getField(row, ["Code","SKU","Model","Item","Product Code"])) ||
      str((row as any).code) || str((row as any).sku);

    const imageUrl =
      str(getField(row, [
        "ImageURL","Image URL","Image","Photo","Thumbnail","Picture",
        "Image Link","Main Image","MainImage","Primary Image","Image Src","ImageSrc"
      ])) ||
      str((row as any).imageUrl) ||
      str((row as any).image) ||
      str((row as any).thumbnail);

    const bullets = toBulletLines(row);

    dlog({ title, code, imageUrl, bullets: bullets.length });

    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    // Title (centered)
    s.addText(title, {
      ...L.title,
      fontFace: "Inter", fontSize: 22, bold: true, color: brand.text, align: "center", fit: "shrink",
    } as any);

    // Left image (proxy → base64 → ensure PNG/JPEG → addImage)
    const im = await fetchAsDataUrl(imageUrl);
    if (im.ok && im.dataUrl) {
      const header = toPptxBase64Header(im.dataUrl);
      if (!/^image\/(png|jpeg);base64,/i.test(header)) {
        // Visible reason if weird header survives conversion
        s.addShape(PptxGenJS.ShapeType.roundRect, { ...L.img, fill: { color: brand.faint } } as any);
        s.addText("Image format not supported", {
          x: L.img.x, y: L.img.y + L.img.h / 2 - 0.2, w: L.img.w, h: 0.4,
          align: "center", fontFace: "Inter", fontSize: 12, color: "667085",
        } as any);
      } else {
        s.addImage({
          data: header,
          ...L.img,
          sizing: { type: "contain", w: L.img.w, h: L.img.h },
        } as any);
      }
    } else {
      // Placeholder + visible reason helps you fix the row fast
      s.addShape(PptxGenJS.ShapeType.roundRect, {
        ...L.img, fill: { color: brand.faint }, line: { color: "D0D7E2", width: 1 },
      } as any);
      s.addText(`Image unavailable (${im.msg || "unknown"})`, {
        x: L.img.x, y: L.img.y + L.img.h / 2 - 0.2, w: L.img.w, h: 0.4,
        align: "center", fontFace: "Inter", fontSize: 12, color: "667085",
      } as any);
    }

    // Right bullets
    if (bullets.length) {
      s.addText(
        bullets.map((b) => `• ${b}`).join("\n"),
        { ...L.specs, fontSize: 12, fontFace: "Inter", color: "111827" } as any
      );
    }

    // Description along the bottom
    if (description) {
      s.addText(description, {
        ...L.desc, align: "center", fontFace: "Inter", fontSize: 12, color: "344054", fit: "shrink",
      } as any);
    }

    // Footer bar + code (optional)
    s.addShape(PptxGenJS.ShapeType.rect, { ...L.bar, fill: { color: brand.bar }, line: { color: brand.bar } } as any);
    if (code) {
      s.addText(code, { ...L.barText, fontFace: "Inter", fontSize: 12, color: "0B3A33", align: "left" } as any);
    }
  }

  // Thank-you slide
  {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };
    s.addText("Thank you", {
      x: 0.8, y: 2.0, w: 8.5, h: 1, fontFace: "Inter", fontSize: 36, bold: true, color: "0F172A", align: "center",
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
