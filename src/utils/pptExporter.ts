// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* =========================
   THEME
   ========================= */
const FONT = "Calibri";                  // primary
const COLOR_BG = "FFFFFF";
const COLOR_TEXT = "0F172A";
const COLOR_SUB = "334155";
const COLOR_MUTED = "64748B";
const COLOR_FOOTER = "0B3C8C";           // adjust if needed
const COLOR_GUIDE = "C7D2FE";
const COLOR_DESC = "374151";

// 16:9 coords (13.33 x 7.5 inches)
const COVER = {
  title:   { x: 0.6, y: 1.0, w: 12.1 },
  sub:     { x: 0.6, y: 1.8, w: 12.1 },
  date:    { x: 0.6, y: 2.15, w: 12.1 },
  logo:    { x: 3.6, y: 2.7, w: 6.1, h: 3.1 },
};
const PRODUCT = {
  img:     { x: 0.6, y: 0.8, w: 6.3, h: 4.3 },
  specs:   { x: 7.2, y: 0.8, w: 5.6, h: 4.3 },
  titleBox:{ x: 3.7, y: 5.25, w: 6.0, h: 0.9 },
  title:   { x: 3.8, y: 5.38, w: 5.8 },
  desc:    { x: 3.8, y: 6.2,  w: 5.8 },
  code:    { x: 0.6, y: 6.4,  w: 2.0 },
  footer:  { bar: { x: 0.5, y: 6.9, w: 12.3, h: 0.35 }, text: { x: 0.7, y: 6.95, w: 12.0 } },
};

/* =========================
   Proxy + fetch helpers
   ========================= */
const toB64 = (s: string) => {
  try { return btoa(unescape(encodeURIComponent(s))); }
  catch { return window.btoa(s as any); }
};
const viaProxy = (u?: string | null) => {
  const s = (u ?? "").toString().trim();
  if (!s || !/^https?:\/\//i.test(s)) return undefined;
  return `/api/pdf-proxy?url_b64=${toB64(s)}`;
};
async function urlToDataUrl(u: string): Promise<string> {
  const proxied = viaProxy(u);
  if (!proxied) throw new Error("Bad URL");
  const res = await fetch(proxied, { credentials: "omit" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
const strip = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

/* =========================
   text helper (avoid name clash)
   ========================= */
const tx = (slide: any, text: string, opts: any) =>
  slide.addText(text, { fontFace: FONT, ...opts });

/* =========================
   Exporter
   ========================= */
export async function exportDeckFromProducts({
  client,
  products,
}: { client: ClientInfo; products: Product[] }) {
  const pptx = new PptxGenJS();

  // Landscape 16:9
  let layoutSet = false;
  try { (pptx as any).layout = "LAYOUT_16x9"; layoutSet = true; } catch {}
  if (!layoutSet && (pptx as any).defineLayout) {
    (pptx as any).defineLayout({ name: "WIDE16x9", width: 13.33, height: 7.5 });
    (pptx as any).layout = "WIDE16x9";
    layoutSet = true;
  }
  if (!layoutSet) { (pptx as any).layout = "LAYOUT_WIDE"; }

  // Masters (valid keys: rect/text/image/line/chart/placeholder)
  pptx.defineSlideMaster({
    title: "COVER",
    background: { color: COLOR_BG },
    objects: [
      { text: { text: "SELECTION DECK", options: { x: 0.6, y: 0.5, w: 12.1, fontSize: 12, bold: true, color: "666666", fontFace: FONT } } },
      { text: { text: "<<TITLE>>",      options: { ...COVER.title, fontSize: 38, bold: true, color: COLOR_TEXT,  fontFace: FONT } } },
      { text: { text: "<<SUB>>",        options: { ...COVER.sub,   fontSize: 16, color: COLOR_SUB,               fontFace: FONT } } },
      { text: { text: "<<DATE>>",       options: { ...COVER.date,  fontSize: 12, color: COLOR_MUTED,             fontFace: FONT } } },
    ],
  });

  pptx.defineSlideMaster({
    title: "PRODUCT",
    background: { color: COLOR_BG },
    objects: [
      { rect: { ...PRODUCT.footer.bar, line: { color: COLOR_FOOTER }, fill: { color: COLOR_FOOTER } } },
      { rect: { ...PRODUCT.img,        line: { color: COLOR_GUIDE },  fill: { color: "F8FAFC" } } },
      { rect: { ...PRODUCT.specs,      line: { color: COLOR_GUIDE },  fill: { color: "FFFFFF" } } },
      { rect: { ...PRODUCT.titleBox,   line: { color: "9CA3AF"   },   fill: { color: "FFFFFF" } } },
    ],
    slideNumber: { x: 0.15, y: 7.1, color: "9CA3AF", fontSize: 10 },
  });

  // Cover slide
  {
    const s = pptx.addSlide({ masterName: "COVER" });
    tx(s, client.projectName || "Project Selection", COVER.title);
    tx(s, `Prepared for ${client.clientName || "Client name"}`, COVER.sub);
    tx(
      s,
      client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString(),
      COVER.date
    );
    s.addImage({ path: "/logo.png", ...COVER.logo, sizing: { type: "contain", w: COVER.logo.w, h: COVER.logo.h } });
  }

  // Product slides
  for (const raw of products) {
    const productName   = String((raw as any).name ?? (raw as any).product ?? "Product");
    const productCode   = String((raw as any).code ?? (raw as any).sku ?? "");
    const imageUrl      = String((raw as any).imageurl ?? (raw as any).image ?? (raw as any).thumbnail ?? "");
    const pdfUrl        = String((raw as any).pdfurl ?? (raw as any).pdf_url ?? "");
    const description   = String((raw as any).description ?? "");
    const specsBullets  = ((raw as any).specs ?? (raw as any).specsbullets) as string[] | undefined;

    const contactName   = String((raw as any).contactname ?? client.contactName ?? "");
    const contactBits   = [
      (raw as any).contactemail ?? client.contactEmail ?? "",
      (raw as any).contactphone ?? client.contactPhone ?? "",
    ].filter(Boolean);
    const contactFooter = [contactName, contactBits.join("  |  ")].filter(Boolean).join("      ");

    const s = pptx.addSlide({ masterName: "PRODUCT" });

    // Left image
    if (imageUrl) {
      try {
        const dataUrl = await urlToDataUrl(imageUrl);
        s.addImage({ data: strip(dataUrl), ...PRODUCT.img, sizing: { type: "contain", w: PRODUCT.img.w, h: PRODUCT.img.h } });
      } catch { /* leave guide box */ }
    }

    // Right specs: PDF page OR bullets
    let specsDrawn = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1400);
        s.addImage({ data: strip(png), ...PRODUCT.specs, sizing: { type: "contain", w: PRODUCT.specs.w, h: PRODUCT.specs.h } });
        specsDrawn = true;
      } catch { /* fall back */ }
    }
    if (!specsDrawn && specsBullets && specsBullets.length) {
      tx(s, specsBullets.map((b) => `• ${b}`).join("\n"), {
        x: PRODUCT.specs.x + 0.15, y: PRODUCT.specs.y + 0.15,
        w: PRODUCT.specs.w - 0.3,  h: PRODUCT.specs.h - 0.3,
        fontSize: 12, color: COLOR_SUB,
      });
    }

    // Title in box (auto-size for long names)
    const size = Math.min(22, Math.max(16, 26 - Math.max(0, productName.length - 36) * 0.3));
    tx(s, productName, { ...PRODUCT.title, fontSize: size, bold: true, color: COLOR_TEXT, align: "center" });

    // Description centered
    if (description) tx(s, `• ${description}`, { ...PRODUCT.desc, fontSize: 12, color: COLOR_DESC, align: "center" });

    // Product code (left-bottom)
    if (productCode) tx(s, productCode, { ...PRODUCT.code, fontSize: 11, color: COLOR_TEXT });

    // Footer contact (on blue bar)
    if (contactFooter) tx(s, contactFooter, { ...PRODUCT.footer.text, fontSize: 10, color: "FFFFFF" });
  }

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}