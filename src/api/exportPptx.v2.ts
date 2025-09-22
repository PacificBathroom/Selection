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
        x: 0.4, y: 2.2, w: 9.2, h: 0.6, fontFace: "
