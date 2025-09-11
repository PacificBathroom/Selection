// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* ===== STYLE ===== */
const FONT = "Calibri";
const COLOR_TEXT = "0F172A";
const COLOR_SUB = "334155";
const COLOR_MUTED = "64748B";

/* ===== GEOMETRY (16:9) ===== */
const PRODUCT = {
  img:   { x: 0.6, y: 0.8, w: 6.0, h: 4.2 },
  specs: { x: 7.0, y: 0.8, w: 5.5, h: 4.2 },
  title: { x: 0.6, y: 5.2, w: 12.0 },
  desc:  { x: 0.6, y: 5.8, w: 12.0 },
  code:  { x: 0.6, y: 6.2, w: 12.0 },
  footer:{ bar:{ x:0, y:6.8, w:13.33, h:0.35 }, text:{ x:0.3, y:6.85, w:12.7 } }
};

/* ===== HELPERS ===== */
const tx = (s: any, t: string, o: any) => t && s.addText(t, { fontFace: FONT, ...o });

const strip = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

const viaProxy = (u?: string | null) => {
  const s = (u ?? "").toString().trim();
  if (!s || !/^https?:\/\//i.test(s)) return undefined;
  return `/api/pdf-proxy?url=${encodeURIComponent(s)}`;
};

async function fetchAsDataUrl(u: string): Promise<string> {
  const proxied = viaProxy(u);
  if (!proxied) throw new Error("Bad URL");
  const res = await fetch(proxied, { credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

const autoTitleSize = (name: string) => {
  const len = name?.length || 0;
  if (len <= 28) return 24;
  if (len <= 36) return 22;
  if (len <= 48) return 20;
  if (len <= 60) return 18;
  return 16;
};

/* ===== EXPORTER ===== */
export async function exportDeckFromProducts({
  client,
  products,
}: { client: ClientInfo; products: Product[] }) {
  const pptx = new PptxGenJS();
  (pptx as any).layout = "LAYOUT_16x9";

  /* --- COVER 1 --- */
  {
    const s = pptx.addSlide();
    s.addImage({ path: "/cover-bg-1.png", x: 0, y: 0, w: "100%", h: "100%" });
    tx(s, client.projectName || "Project Selection", { x: 0.8, y: 1.0, w: 11.5, fontSize: 34, bold: true, color: COLOR_TEXT });
    tx(s, `Prepared for ${client.clientName || "Client"}`, { x: 0.8, y: 1.7, w: 11.5, fontSize: 16, color: COLOR_SUB });
    tx(s, client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString(), { x: 0.8, y: 2.1, w: 11.5, fontSize: 12, color: COLOR_MUTED });
  }

  /* --- COVER 2 --- */
  {
    const s = pptx.addSlide();
    s.addImage({ path: "/cover-bg-2.png", x: 0, y: 0, w: "100%", h: "100%" });
    tx(s, client.projectName || "Project Selection", { x: 0.8, y: 1.0, w: 11.5, fontSize: 28, bold: true, color: COLOR_TEXT });
    tx(s, `Prepared for ${client.clientName || "Client"}`, { x: 0.8, y: 1.7, w: 11.5, fontSize: 16, color: COLOR_SUB });
  }

  /* --- PRODUCT SLIDES --- */
  for (const raw of products) {
    const productName = String((raw as any).name ?? (raw as any).product ?? "Product");
    const productCode = String((raw as any).code ?? "");
    const imageUrl    = String((raw as any).image ?? (raw as any).imageurl ?? "");
    const pdfUrl      = String((raw as any).pdfurl ?? "");
    const description = String((raw as any).description ?? "");
    const specsBullets = (raw as any).specs as string[] | undefined;

    const s = pptx.addSlide();

    // left image
    if (imageUrl) {
      try {
        const d = await fetchAsDataUrl(imageUrl);
        s.addImage({ data: strip(d), ...PRODUCT.img, sizing: { type: "contain", w: PRODUCT.img.w, h: PRODUCT.img.h } });
      } catch {}
    }

    // right specs
    let specsDrawn = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1200);
        s.addImage({ data: strip(png), ...PRODUCT.specs, sizing: { type: "contain", w: PRODUCT.specs.w, h: PRODUCT.specs.h } });
        specsDrawn = true;
      } catch {}
    }
    if (!specsDrawn && specsBullets && specsBullets.length) {
      tx(s, specsBullets.map((b) => `• ${b}`).join("\n"), { x: PRODUCT.specs.x, y: PRODUCT.specs.y, w: PRODUCT.specs.w, h: PRODUCT.specs.h, fontSize: 12, color: COLOR_SUB });
    }

    // title / desc / code
    tx(s, productName, { ...PRODUCT.title, fontSize: autoTitleSize(productName), bold: true, color: COLOR_TEXT, align: "center" });
    if (description) tx(s, description, { ...PRODUCT.desc, fontSize: 12, color: COLOR_SUB, align: "center" });
    if (productCode) tx(s, productCode, { ...PRODUCT.code, fontSize: 11, color: COLOR_TEXT, align: "center" });
  }

  /* --- END SLIDES (BLANK BACKGROUNDS) --- */
  {
    const s = pptx.addSlide();
    s.addImage({ path: "/end-bg-1.png", x: 0, y: 0, w: "100%", h: "100%" });
  }
  {
    const s = pptx.addSlide();
    s.addImage({ path: "/end-bg-2.png", x: 0, y: 0, w: "100%", h: "100%" });
  }

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}
