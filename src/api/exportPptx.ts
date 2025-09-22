// Product selection → PPTX exporter (PptxGenJS)
// v2.3 – robust image handling + safe layout
console.log("[pptx] exporter version: v2.3");

import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// Use the Netlify redirect /api/* → /.netlify/functions/*
const PROXY = (u: string) => `/api/file-proxy?url=${encodeURIComponent(u)}`;

const DEBUG = true;
const dlog = (...a: any[]) => DEBUG && console.log("[pptx]", ...a);

// ---------- helpers ----------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const str = (v: unknown) => (v == null ? undefined : String(v).trim() || undefined);

function extractUrlFromImageFormula(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^=*\s*image\s*\(\s*"([^"]+)"\s*(?:,.*)?\)\s*$/i);
  return m?.[1];
}

function getField<T = unknown>(row: Record<string, any>, aliases: string[]): T | undefined {
  const want = aliases.map(norm);
  for (const k of Object.keys(row)) {
    if (want.includes(norm(k))) {
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
  s = s.replace(/^"+|"+$/g, "");
  if (s.startsWith("//")) s = "https:" + s;
  s = s.replace(/\s/g, "%20");
  return s;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}

// Load any dataURL → draw → PNG dataURL
async function ensurePngDataUrl(dataUrl: string): Promise<string | undefined> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 1;
        canvas.height = img.naturalHeight || 1;
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

// Fetch via proxy → ArrayBuffer → base64 → dataURL → PNG
async function fetchAsPngDataUrl(rawUrl?: string): Promise<string | undefined> {
  const url = normalizeImageUrl(rawUrl);
  if (!url) return undefined;

  const res = await fetch(PROXY(url));
  if (!res.ok) {
    dlog("proxy fetch failed", res.status, url);
    return undefined;
  }

  const ct = res.headers.get("content-type") ?? "application/octet-stream";

  let base64: string;
  try {
    const buf = await res.arrayBuffer();     // binary (because isBase64Encoded:true)
    base64 = arrayBufferToBase64(buf);
  } catch {
    base64 = await res.text();               // fallback if provider sent base64 text
  }

  const dataUrl = `data:${ct};base64,${base64}`;
  const png = await ensurePngDataUrl(dataUrl);
  return png;
}

function toBulletLines(row: Record<string, any>): string[] {
  const lines: string[] = [];

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

  if (!lines.length) {
    const SKIP = new Set(
      ["name","product","title","code","sku","image","imageurl","photo","thumbnail","url","link",
       "pdf","pdfurl","specpdfurl","description","desc","shortdescription","longdescription","specsbullets"].map(norm)
    );
    for (const key of Object.keys(row)) {
      if (SKIP.has(norm(key))) continue;
      const val = String((row as any)[key] ?? "").trim();
      if (!val) continue;
      if (val.length <= 120) lines.push(`${key.replace(/\s+/g, " ").trim()}: ${val}`);
      if (lines.length >= 12) break;
    }
  }

  return lines.slice(0, 12);
}

// ---------- PPT export ----------
export async function exportSelectionToPptx(rows: Product[], client: ClientInfo) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";          // 10.0 x 5.625 in
  pptx.title = client.projectName || "Product Presentation";

  const slideW = 10.0;
  const slideH = 5.625;
  const brand = { bg: "FFFFFF", text: "0F172A", accent: "1E6BD7", faint: "F1F5F9", bar: "24D3EE" };

  // Cover
  {
    const s = pptx.addSlide();
    s.background = { color: brand.bg };
    s.addText(client.projectName || "Project Selection", {
      x: 0.4, y: 1.0, w: 9.2, h: 1.1, fontFace: "Inter", fontSize: 40, bold: true, color: brand.text, align: "center",
    } as any);
    const sub: string[] = [];
    if (client.clientName) sub.push(`Client: ${client.clientName}`);
    if (client.dateISO) sub.push(client.dateISO);
    if (sub.length) {
      s.addText(sub.join("  ·  "), {
        x: 0.4, y: 2.2, w: 9.2, h: 0.6, fontFace: "Inter", fontSize: 16, color: "666666", align: "center",
      } as any);
    }
  }

  // Layout (kept inside slide bounds)
  const barH = 0.30;
  const barY = slideH - barH;
  const descH = 0.48;
  const descY = barY - 0.35;

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
    dlog({ title, code, imageUrl, bullets: bullets.length });

    const s = pptx.addSlide();
    s.background = { color: brand.bg };

    s.addText(title, {
      ...L.title, fontFace: "Inter", fontSize: 22, bold: true, color: brand.text, align: "center", fit: "shrink",
    } as any);

    // visible stamp to confirm this version ran
    s.addText("NEW exporter v2", { x: 0.15, y: 0.15, w: 2, h: 0.3, fontSize: 10, color: "FF0000" } as any);

    // Image
    const pngDataUrl = await fetchAsPngDataUrl(imageUrl);
    if (pngDataUrl) {
      const header = pngDataUrl.slice(5); // strip "data:"
      s.addImage({ data: header, ...L.img, sizing: { type: "contain", w: L.img.w, h: L.img.h } } as any);
    } else {
      s.addShape(PptxGenJS.ShapeType.roundRect, { ...L.img, fill: { color: brand.faint }, line: { color: "D0D7E2", width: 1 } } as any);
      s.addText("Image unavailable", {
        x: L.img.x, y: L.img.y + L.img.h / 2 - 0.2, w: L.img.w, h: 0.4, align: "center", fontFace: "Inter", fontSize: 12, color: "667085",
      } as any);
    }

    if (bullets.length) {
      s.addText(bullets.map((b) => `• ${b}`).join("\n"), { ...L.specs, fontSize: 12, fontFace: "Inter", color: "111827" } as any);
    }

    if (description) {
      s.addText(description, { ...L.desc, align: "center", fontFace: "Inter", fontSize: 12, color: "344054", fit: "shrink" } as any);
    }

    s.addShape(PptxGenJS.ShapeType.rect, { ...L.bar, fill: { color: brand.bar }, line: { color: brand.bar } } as any);
    if (code) s.addText(code, { ...L.barText, fontFace: "Inter", fontSize: 12, color: "0B3A33", align: "left" } as any);
  }

  // Thank-you slide
  {
    const s = pptx.addSlide();
    s.background = { color: "FFFFFF" };
    s.addText("Thank you", { x: 0.8, y: 2.0, w: 8.5, h: 1, fontSize: 36, bold: true, color: "0F172A", align: "center" } as any);
    const parts: string[] = [];
    if (client.contactName) parts.push(client.contactName);
    if (client.contactEmail) parts.push(client.contactEmail);
    if (client.contactPhone) parts.push(client.contactPhone);
    if (parts.length) s.addText(parts.join("  ·  "), { x: 0.8, y: 3.2, w: 8.5, h: 0.8, fontSize: 16, color: "666666", align: "center" } as any);
  }

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` } as any);
}

export const exportPptxV2 = exportSelectionToPptx;
export const exportPptx = exportSelectionToPptx;
