// src/api/exportPptx.ts
// Product selection → PPTX exporter (PptxGenJS)
// v2.4 — binary fetch via proxy, robust image coercion to PNG

console.log("[pptx] exporter version: v2.4");

import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

/* ------------------------------------------------------------------ */
/* Config                                                             */
/* ------------------------------------------------------------------ */
const SITE =
  (typeof window !== "undefined" && window.location?.origin) ||
  "https://pacificbathroomselection.netlify.app";

const PROXY = (rawUrl: string) =>
  `${SITE}/.netlify/functions/file-proxy?url=${encodeURIComponent(rawUrl)}`;

const DEBUG = true;
const dlog = (...a: any[]) => DEBUG && console.log("[pptx]", ...a);

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const str = (v: unknown) => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
};

function extractUrlFromImageFormula(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^=*\s*image\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
}

function getField<T = unknown>(row: Record<string, any>, aliases: string[]): T | undefined {
  const want = aliases.map(norm);
  for (const k of Object.keys(row)) {
    const nk = norm(k);
    if (want.includes(nk)) {
      const raw = (row as any)[k];
      const img = extractUrlFromImageFormula(raw);
      return (img ?? raw) as T;
    }
  }
  return undefined;
}

function normalizeImageUrl(u?: string): string | undefined {
  if (!u) return undefined;
  let s = String(u).trim();
  s = s.replace(/^"+|"+$/g, ""); // strip wrapping quotes
  if (s.startsWith("//")) s = "https:" + s;
  s = s.replace(/\s/g, "%20");   // spaces → %20
  return s;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(binary);
}

// Draw any dataURL onto a canvas → get guaranteed PNG dataURL
async function ensurePngDataUrl(dataUrl: string): Promise<string | undefined> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || 1;
        c.height = img.naturalHeight || 1;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(undefined);
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/png"));
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
}

// Fetch via Netlify proxy → bytes → base64 → dataURL → PNG dataURL
async function fetchAsPngDataUrl(rawUrl?: string): Promise<string | undefined> {
  const url = normalizeImageUrl(rawUrl);
  if (!url) return undefined;

  const res = await fetch(PROXY(url));
  if (!res.ok) {
    dlog("proxy fetch failed", res.status, url);
    return undefined;
  }

  // Function returns binary (isBase64Encoded:true). Read bytes:
  let base64: string;
  try {
    const buf = await res.arrayBuffer();
    base64 = arrayBufferToBase64(buf);
  } catch {
    base64 = await res.text(); // rare fallback
  }

  const ct = (res.headers.get("content-type") || "image/jpeg").toLowerCase();
  const dataUrl = `data:${ct};base64,${base64}`;
  const png = await ensurePngDataUrl(dataUrl);
  if (!png) {
    dlog("ensurePngDataUrl failed");
    return undefined;
  }
  return png;
}

// PptxGenJS expects 'image/<type>;base64,...' (no 'data:' prefix)
function toPptxBase64Header(dataUrl: string): string {
  let s = dataUrl.trim();
  if (s.startsWith("data:")) s = s.slice(5);
  if (s.startsWith("application/octet-stream;base64,")) {
    s = "image/jpeg;base64," + s.split("base64,")[1];
  }
  return s;
}

function toBulletLines(row: Record<string, any>): string[] {
  const lines: string[] = [];

  // Array form
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

  // Long text
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

  // Fallback: short K/V
  if (!lines.length) {
    const SKIP = new Set(
      ["name","product","title","code","sku","image","imageurl","photo","thumbnail","url","link",
       "pdf","pdfurl","specpdfurl","description","desc","shortdescription","longdescription","specsbullets"]
      .map(norm)
    );
    for (const key of Object.keys(row)) {
      const nk = norm(key);
      if (SKIP.has(nk)) continue;
      const val = String((row as any)[key] ?? "").trim();
      if (!val) continue;
      if (val.length <= 120) lines.push(`${key.replace(/\s+/g, " ").trim()}: ${val}`);
      if (lines.length >= 12) break;
    }
  }

  return lines.slice(0, 12);
}

/* ------------------------------------------------------------------ */
/* Exporter                                                           */
/* ------------------------------------------------------------------ */
export async function exportSelectionToPptx(rows: Product[], client: ClientInfo) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9"; // 10.0 x 5.625 in
  pptx.title = client.projectName || "Product Presentation";

  // Slide geometry (keeps footer & desc on-page)
  const slideW = 10.0;
  const slideH = 5.625;
  const barH = 0.30;
  const barY = slideH - barH;
  const descH = 0.48;
  const descY = barY - 0.35;

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
    const meta: string[] = [];
    if (client.clientName) meta.push(`Client: ${client.clientName}`);
    if (client.dateISO) meta.push(client.dateISO);
    if (meta.length) {
      s.addText(meta.join("  ·  "), {
        x: 0.4, y: 2.2, w: 9.2, h: 0.6, fontFace: "Inter", fontSize: 16, color: "666666", align: "center",
      } as any);
    }
  }

  const L = {
    title:   { x: 0.5, y: 0.5, w: 9.0, h: 0.7 },
    img:     { x: 0.5, y: 1.1, w: 5.2, h: 3.7 },
    specs:   { x: 6.0, y: 1.1, w: 3.5, h: 3.9 },
    desc:    { x: 0.6, y: descY, w: 8.8, h: descH },
    bar:     { x: 0.0, y: barY, w: slideW, h: barH },
    barText: { x: 0.6, y: barY - 0.26, w: 8.8, h: 0.25 },
  };

  for (const row of rows as unknown as Record<string, any>[]) {
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
      str(getField(row, ["ImageURL","Image URL","Image","Photo","Thumbnail","Picture","Image Link","Main Image","MainImage","Primary Image","Image Src","ImageSrc"])) ||
      str((row as any).imageUrl) || str((row as any).image) || str((row as any).thumbnail);

    const bullets = toBulletLines(row);
    dlog({ title, code, hasImage: !!imageUrl, bullets: bullets.length });

    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    s.addText(title, {
      ...L.title, fontFace: "Inter", fontSize: 22, bold: true, color: brand.text, align: "center", fit: "shrink",
    } as any);

    // add a tiny stamp so you can see v2.4 ran
    s.addText("NEW exporter v2.4", { x: 0.15, y: 0.15, w: 2, h: 0.3, fontSize: 10, color: "FF0000" } as any);

    // Image (via proxy)
    const pngDataUrl = await fetchAsPngDataUrl(imageUrl);
    if (pngDataUrl) {
      s.addImage({
        data: toPptxBase64Header(pngDataUrl),
        ...L.img,
        sizing: { type: "contain", w: L.img.w, h: L.img.h },
      } as any);
    } else {
      s.addShape(PptxGenJS.ShapeType.roundRect, {
        ...L.img, fill: { color: brand.faint }, line: { color: "D0D7E2", width: 1 },
      } as any);
      s.addText("Image unavailable", {
        x: L.img.x, y: L.img.y + L.img.h / 2 - 0.2, w: L.img.w, h: 0.4,
        align: "center", fontFace: "Inter", fontSize: 12, color: "667085",
      } as any);
    }

    // Specs
    if (bullets.length) {
      s.addText(bullets.map((b) => `• ${b}`).join("\n"), {
        ...L.specs, fontSize: 12, fontFace: "Inter", color: "111827",
      } as any);
    }

    // Description
    if (description) {
      s.addText(description, {
        ...L.desc, align: "center", fontFace: "Inter", fontSize: 12, color: "344054", fit: "shrink",
      } as any);
    }

    // Footer bar + code
    s.addShape(PptxGenJS.ShapeType.rect, { ...L.bar, fill: { color: brand.bar }, line: { color: brand.bar } } as any);
    if (code) {
      s.addText(code, { ...L.barText, fontFace: "Inter", fontSize: 12, color: "0B3A33", align: "left" } as any);
    }
  }

  // Thank-you
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

// public names
export const exportPptxV2 = exportSelectionToPptx;
export const exportPptx   = exportSelectionToPptx;
