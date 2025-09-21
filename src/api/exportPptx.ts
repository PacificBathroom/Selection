// src/api/exportPptx.ts
function toPptxBase64Header(dataUrl: string): string {
  // Accept either "data:image/png;base64,..." or "image/png;base64,..."
  let s = dataUrl.trim();
  if (s.startsWith("data:")) s = s.slice(5);               // remove "data:"
  // Some hosts reply "application/octet-stream" – force to a real image header for PPTX
  if (s.startsWith("application/octet-stream;base64,")) {
    s = "image/jpeg;base64," + s.split("base64,")[1];      // default to jpeg header
  }
  return s;
}

import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// -------------------------------------------------------------
// Settings
// -------------------------------------------------------------
// Use the Netlify function you created earlier:
const PROXY = (rawUrl: string) =>
  `/.netlify/functions/file-proxy?url=${encodeURIComponent(rawUrl)}`;

// Turn off PDF thumbnails for stability (you can re-enable later if you want)
const SHOW_PDF_THUMBS = false;

// Simple console tracer
const DEBUG = true;
const dlog = (...a: any[]) => DEBUG && console.log("[pptx]", ...a);

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
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

async function fetchAsDataUrl(rawUrl?: string): Promise<string | undefined> {
  if (!rawUrl) return undefined;
  const res = await fetch(PROXY(rawUrl));
  if (!res.ok) {
    dlog("proxy fetch failed", res.status, rawUrl);
    return undefined;
  }
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const b64 = await res.text(); // function returns base64 text
  return `data:${contentType};base64,${b64}`;
}

/**
 * Build a simple bullet list (array of lines) from flexible row shapes:
 * - "SpecsBullets" | "Specifications" | "Features" etc (multi-line or | or •)
 * - An array field "specs" of strings or {label,value}
 * - Fallback: short key/value fields become "Label: value"
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

// -------------------------------------------------------------
// PPT Export (matches your screenshot layout)
// -------------------------------------------------------------
export async function exportSelectionToPptx(rows: Product[], client: ClientInfo) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = client.projectName || "Product Presentation";

  // Palette
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
      str(getField(row, ["ImageURL","Image URL","Image","Photo","Thumbnail","Picture","Image Link","Main Image"])) ||
      str((row as any).imageUrl) || str((row as any).image) || str((row as any).thumbnail);

    const bullets = toBulletLines(row);

    dlog({ title, code, imageUrl, bullets: bullets.length });

    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    // Title (centered)
    s.addText(title, {
      ...L.title,
      fontFace: "Inter", fontSize: 22, bold: true, color: brand.text, align: "center", fit: "shrink",
    } as any);

    // Left image (via proxy → base64 data URL)
    const dataUrl = await fetchAsDataUrl(imageUrl);
    if (dataUrl) {
     s.addImage({
  data: toPptxBase64Header(dataUrl),
  ...L.img,
  sizing: { type: "contain", w: L.img.w, h: L.img.h },
} as any);

    } else {
      // light placeholder if image fails
      s.addShape(PptxGenJS.ShapeType.roundRect, {
        ...L.img, fill: { color: brand.faint }, line: { color: "D0D7E2", width: 1 },
      } as any);
      s.addText("Image unavailable", {
        x: L.img.x, y: L.img.y + L.img.h/2 - 0.2, w: L.img.w, h: 0.4,
        align: "center", fontFace: "Inter", fontSize: 12, color: "667085",
      } as any);
    }

    // Right bullets (this mirrors your screenshot)
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
