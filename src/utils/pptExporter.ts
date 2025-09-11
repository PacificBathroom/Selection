// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* ---------- helpers: base64 proxy + dataURL ---------- */
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
  const r = await fetch(proxied, { credentials: "omit" });
  if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
  const blob = await r.blob();
  return await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}
const strip = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

/* ---------- exporter ---------- */
export async function exportDeckFromProducts({
  client,
  products,
}: { client: ClientInfo; products: Product[] }) {
  const pptx = new PptxGenJS();

  // Landscape 16:9
  let ok = false;
  try { (pptx as any).layout = "LAYOUT_WIDE"; ok = true; } catch {}
  if (!ok && (pptx as any).defineLayout) {
    (pptx as any).defineLayout({ name: "WIDE16x9", width: 13.33, height: 7.5 });
    (pptx as any).layout = "WIDE16x9";
  }

  // ---- Masters matching your example ----
  // Colors: adjust if you want exact brand tones
  const blue = "1D4ED8";
  const slate = "0F172A";

  // Cover master
  pptx.defineSlideMaster({
    title: "COVER",
    background: { color: "FFFFFF" },
    objects: [
      { text: { text: "SELECTION DECK", options: { x: 0.6, y: 0.5, w: 12.1, fontSize: 12, bold: true, color: "666666" } } },
      // project title placeholder
      { text: { text: "<<TITLE>>", options: { x: 0.6, y: 1.0, w: 12.1, fontSize: 38, bold: true, color: slate } } },
      // small subtitle & date placeholders
      { text: { text: "<<SUB>>", options: { x: 0.6, y: 1.8, w: 12.1, fontSize: 16, color: "334155" } } },
      { text: { text: "<<DATE>>", options: { x: 0.6, y: 2.15, w: 12.1, fontSize: 12, color: "64748B" } } },
    ]
  });

  // Product master: image left, specs right, name box center, footer bar
  pptx.defineSlideMaster({
    title: "PRODUCT",
    background: { color: "FFFFFF" },
    objects: [
      // footer bar
      { shape: { type: pptx.ShapeType.rect, x: 0.5, y: 6.9, w: 12.3, h: 0.35, line: { color: blue }, fill: { color: blue } } },
      // image bounding box (light stroke as template guide)
      { shape: { type: pptx.ShapeType.rect, x: 0.6, y: 0.8, w: 6.3, h: 4.3, line: { color: "C7D2FE" }, fill: { color: "F8FAFC" } } },
      // specs bounding box
      { shape: { type: pptx.ShapeType.rect, x: 7.2, y: 0.8, w: 5.6, h: 4.3, line: { color: "C7D2FE" }, fill: { color: "FFFFFF" } } },
      // centered title box
      { shape: { type: pptx.ShapeType.rect, x: 3.7, y: 5.25, w: 6.0, h: 0.9, line: { color: "9CA3AF" }, fill: { color: "FFFFFF" } } },
    ]
  });

  // -------- Cover slide --------
  {
    const s = pptx.addSlide({ masterName: "COVER" });
    s.addText(client.projectName || "Project Selection", { x: 0.6, y: 1.0, w: 12.1, fontSize: 38, bold: true, color: slate });
    s.addText(`Prepared for ${client.clientName || "Client name"}`, { x: 0.6, y: 1.8, w: 12.1, fontSize: 16, color: "334155" });
    s.addText(client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString(),
      { x: 0.6, y: 2.15, w: 12.1, fontSize: 12, color: "64748B" });
    // logo (center-ish)
    s.addImage({ path: "/logo.png", x: 3.7, y: 2.7, w: 6.0, h: 3.0, sizing: { type: "contain", w: 6.0, h: 3.0 } });
  }

  // -------- Product slides --------
  for (const raw of products) {
    const productName = String((raw as any).product ?? (raw as any).name ?? "Product");
    const productCode = String((raw as any).sku ?? (raw as any).code ?? "");
    const imageUrl = String((raw as any).thumbnail ?? (raw as any).imageurl ?? (raw as any).image ?? "");
    const pdfUrl = String((raw as any).pdf_url ?? (raw as any).pdfurl ?? "");
    const description = String((raw as any).description ?? "");
    const specsBullets = (raw as any).specs as string[] | undefined;

    const contactName = String((raw as any).contact_name ?? "");
    const contactBits = [
      (raw as any).contact_email ?? "",
      (raw as any).contact_phone ?? "",
    ].filter(Boolean);
    const contactFooter = [contactName || (client.contactName || ""), contactBits.join("  |  ")].filter(Boolean).join("      ");

    const s = pptx.addSlide({ masterName: "PRODUCT" });

    // Image left (fills the image box, keeps aspect)
    if (imageUrl) {
      try {
        const dataUrl = await urlToDataUrl(imageUrl);
        s.addImage({
          data: strip(dataUrl),
          x: 0.6, y: 0.8, w: 6.3, h: 4.3,
          sizing: { type: "contain", w: 6.3, h: 4.3 },
        });
      } catch { /* leave the placeholder box */ }
    }

    // SPECS right – PDF first page or bullets
    let specsDrawn = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1400);
        s.addImage({
          data: strip(png),
          x: 7.2, y: 0.8, w: 5.6, h: 4.3,
          sizing: { type: "contain", w: 5.6, h: 4.3 },
        });
        specsDrawn = true;
      } catch { /* fall back below */ }
    }
    if (!specsDrawn && specsBullets && specsBullets.length) {
      s.addText(
        specsBullets.map((b) => `• ${b}`).join("\n"),
        { x: 7.35, y: 0.95, w: 5.3, h: 4.0, fontSize: 12, color: "334155" }
      );
      specsDrawn = true;
    }

    // Title box (center)
    s.addText(productName, {
      x: 3.8, y: 5.38, w: 5.8,
      fontSize: Math.min(22, Math.max(16, 26 - Math.max(0, productName.length - 36) * 0.3)),
      bold: true, color: slate, align: "center",
    });

    // Description bullet (under title)
    if (description) {
      s.addText(`• ${description}`, { x: 3.8, y: 6.2, w: 5.8, fontSize: 12, color: "374151", align: "center" });
    }

    // Product code (left gutter above footer)
    if (productCode) {
      s.addText(productCode, { x: 0.6, y: 6.4, w: 2.0, fontSize: 11, color: slate });
    }

    // Footer contact
    if (contactFooter) {
      s.addText(contactFooter, { x: 0.7, y: 6.95, w: 12.0, fontSize: 10, color: "FFFFFF" });
    }
  }

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}