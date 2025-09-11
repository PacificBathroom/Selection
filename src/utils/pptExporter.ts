// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* =========================
   THEME
   ========================= */
const FONT = "Calibri";
const COLOR_TEXT = "0F172A";
const COLOR_SUB = "334155";
const COLOR_MUTED = "64748B";
const COLOR_FOOTER = "0B3C8C";
const COLOR_GUIDE = "E5E7EB";
const COLOR_DESC = "374151";

// Layout coordinates
const COVER = {
  title: { x: 0.8, y: 0.9, w: 11.8 },
  sub:   { x: 0.8, y: 1.65, w: 11.8 },
  date:  { x: 0.8, y: 2.05, w: 11.8 },
  logo:  { x: 3.6, y: 2.7, w: 6.1, h: 3.1 },
};

const PRODUCT = {
  img:     { x: 0.6, y: 0.8, w: 6.3, h: 4.3 },
  specs:   { x: 7.2, y: 0.8, w: 5.6, h: 4.3 },
  title:   { x: 3.8, y: 5.38, w: 5.8 },
  desc:    { x: 3.8, y: 6.2,  w: 5.8 },
  code:    { x: 0.6, y: 6.4,  w: 2.0 },
  footer:  { bar: { x: 0.5, y: 6.9, w: 12.3, h: 0.35 }, text: { x: 0.7, y: 6.95, w: 12.0 } },
};

/* =========================
   Helpers
   ========================= */
const tx = (s: any, t: string, o: any) => s.addText(t, { fontFace: FONT, ...o });

const toB64 = (s: string) => {
  try { return btoa(unescape(encodeURIComponent(s))); }
  catch { return window.btoa(s as any); }
};

const viaProxy = (u?: string | null) => {
  const s = (u ?? "").toString().trim();
  if (!s || !/^https?:\/\//i.test(s)) return undefined;
  return `/api/pdf-proxy?url_b64=${toB64(s)}`;
};

async function fetchAsDataUrl(u: string): Promise<string> {
  const proxied = viaProxy(u);
  if (!proxied) throw new Error("Bad URL");
  const res = await fetch(proxied, { credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
const strip = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

const autoTitleSize = (name: string) => {
  const len = name?.length || 0;
  if (len <= 28) return 24;
  if (len <= 36) return 22;
  if (len <= 48) return 20;
  return 18;
};

/* =========================
   Exporter
   ========================= */
export async function exportDeckFromProducts({
  client,
  products,
}: { client: ClientInfo; products: Product[] }) {
  const pptx = new PptxGenJS();
  (pptx as any).layout = "LAYOUT_16x9";

  /* ---------- Cover slides ---------- */
  {
    const s = pptx.addSlide();
    s.background = { path: "/cover-bg-1.png" };
    tx(s, client.projectName || "Project Selection", { ...COVER.title, fontSize: 34, bold: true, color: COLOR_TEXT });
    tx(s, `Prepared for ${client.clientName || "Client"}`, { ...COVER.sub, fontSize: 16, color: COLOR_SUB });
    tx(s, client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString(),
      { ...COVER.date, fontSize: 12, color: COLOR_MUTED });
  }
  {
    const s = pptx.addSlide();
    s.background = { path: "/cover-bg-2.png" };
    tx(s, client.projectName || "Project Selection", { ...COVER.title, fontSize: 28, bold: true, color: COLOR_TEXT });
  }

  /* ---------- Product slides ---------- */
  for (const raw of products) {
    const productName = String((raw as any).name ?? "Product");
    const productCode = String((raw as any).code ?? "");
    const imageUrl = String((raw as any).imageurl ?? "");
    const pdfUrl = String((raw as any).pdfurl ?? "");
    const description = String((raw as any).description ?? "");

    const contactFooter = [client.contactName, client.contactEmail, client.contactPhone]
      .filter(Boolean).join("   |   ");

    const s = pptx.addSlide();

    // left image
    if (imageUrl) {
      try {
        const d = await fetchAsDataUrl(imageUrl);
        s.addImage({ data: strip(d), ...PRODUCT.img, sizing: { type: "contain", w: PRODUCT.img.w, h: PRODUCT.img.h } });
      } catch {}
    }

    // right PDF first page
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1200);
        s.addImage({ data: strip(png), ...PRODUCT.specs, sizing: { type: "contain", w: PRODUCT.specs.w, h: PRODUCT.specs.h } });
      } catch {}
    }

    // title
    tx(s, productName, { ...PRODUCT.title, fontSize: autoTitleSize(productName), bold: true, color: COLOR_TEXT });
    if (description) tx(s, description, { ...PRODUCT.desc, fontSize: 12, color: COLOR_DESC });
    if (productCode) tx(s, productCode, { ...PRODUCT.code, fontSize: 11, color: COLOR_TEXT });
    if (contactFooter) tx(s, contactFooter, { ...PRODUCT.footer.text, fontSize: 10, color: "FFFFFF" });
    s.addShape(pptx.ShapeType.rect, { ...PRODUCT.footer.bar, fill: { color: COLOR_FOOTER }, line: { color: COLOR_FOOTER } });
  }

  /* ---------- Closing slides ---------- */
  {
    const s = pptx.addSlide();
    s.background = { path: "/end-bg-1.png" };
    tx(s, "Thank you", { x: 1, y: 2, w: 10, fontSize: 32, bold: true, color: COLOR_TEXT, align: "center" });
  }
  {
    const s = pptx.addSlide();
    s.background = { path: "/end-bg-2.png" };
    tx(s, "Contact us: info@pacificbathroom.com.au", { x: 1, y: 3, w: 10, fontSize: 20, color: COLOR_SUB, align: "center" });
  }

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}
