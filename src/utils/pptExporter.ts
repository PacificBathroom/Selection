// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* ---------- global styling ---------- */
const FONT = "Calibri";            // primary font
const COLOR_BLUE = "1D4ED8";
const COLOR_SLATE = "0F172A";

/* ---------- helpers: base64 proxy + dataURL (single copy) ---------- */
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

/* small helper to always apply Calibri */
const addText = (slide: any, text: string, opts: any) =>
  slide.addText(text, { fontFace: FONT, ...opts });

/* ---------- exporter ---------- */
export async function exportDeckFromProducts({
  client,
  products,
}: { client: ClientInfo; products: Product[] }) {
  const pptx = new PptxGenJS();

  // Landscape 16:9
  let set = false;
  try { (pptx as any).layout = "LAYOUT_16x9"; set = true; } catch {}
  if (!set && (pptx as any).defineLayout) {
    (pptx as any).defineLayout({ name: "WIDE16x9", width: 13.33, height: 7.5 });
    (pptx as any).layout = "WIDE16x9";
    set = true;
  }
  if (!set) { (pptx as any).layout = "LAYOUT_WIDE"; }

  /* ---------- Masters (use 'rect' / 'text' keys; NOT 'shape') ---------- */
  // Cover master
  pptx.defineSlideMaster({
    title: "COVER",
    background: { color: "FFFFFF" },
    objects: [
      { text: { text: "SELECTION DECK", options: { x: 0.6, y: 0.5, w: 12.1, fontSize: 12, bold: true, color: "666666", fontFace: FONT } } },
      { text: { text: "<<TITLE>>",       options: { x: 0.6, y: 1.0, w: 12.1, fontSize: 38, bold: true, color: COLOR_SLATE, fontFace: FONT } } },
      { text: { text: "<<SUB>>",         options: { x: 0.6, y: 1.8, w: 12.1, fontSize: 16, color: "334155", fontFace: FONT } } },
      { text: { text: "<<DATE>>",        options: { x: 0.6, y: 2.15, w: 12.1, fontSize: 12, color: "64748B", fontFace: FONT } } },
    ],
  });

  // Product master: footer bar + guide boxes
  pptx.defineSlideMaster({
    title: "PRODUCT",
    background: { color: "FFFFFF" },
    objects: [
      // Footer bar
      { rect: { x: 0.5, y: 6.9, w: 12.3, h: 0.35, line: { color: COLOR_BLUE }, fill: { color: COLOR_BLUE } } },
      // Optional placeholders drawn as light guides (harmless if we draw over them)
      { rect: { x: 0.6, y: 0.8, w: 6.3, h: 4.3, line: { color: "C7D2FE" }, fill: { color: "F8FAFC" } } }, // image box
      { rect: { x: 7.2, y: 0.8, w: 5.6, h: 4.3, line: { color: "C7D2FE" }, fill: { color: "FFFFFF" } } }, // specs box
      { rect: { x: 3.7, y: 5.25, w: 6.0, h: 0.9, line: { color: "9CA3AF" }, fill: { color: "FFFFFF" } } }, // title box
    ],
    slideNumber: { x: 0.15, y: 7.1, color: "9CA3AF", fontSize: 10 },
  });

  /* ---------- Cover slide ---------- */
  {
    const s = pptx.addSlide({ masterName: "COVER" });
    addText(s, client.projectName || "Project Selection", { x: 0.6, y: 1.0, w: 12.1, fontSize: 38, bold: true, color: COLOR_SLATE });
    addText(s, `Prepared for ${client.clientName || "Client name"}`, { x: 0.6, y: 1.8, w: 12.1, fontSize: 16, color: "334155" });
    addText(
      client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString(),
      { x: 0.6, y: 2.15, w: 12.1, fontSize: 12, color: "64748B" }
    );
    // Center logo
    s.addImage({ path: "/logo.png", x: 3.7, y: 2.7, w: 6.0, h: 3.0, sizing: { type: "contain", w: 6.0, h: 3.0 } });
  }

  /* ---------- Product slides ---------- */
  for (const raw of products) {
    const productName = String((raw as any).product ?? (raw as any).name ?? "Product");
    const productCode = String((raw as any).sku ?? (raw as any).code ?? "");
    const imageUrl    = String((raw as any).thumbnail ?? (raw as any).imageurl ?? (raw as any).image ?? "");
    const pdfUrl      = String((raw as any).pdf_url ?? (raw as any).pdfurl ?? "");
    const description = String((raw as any).description ?? "");
    const specsBullets = (raw as any).specs as string[] | undefined;

    const contactName  = String((raw as any).contact_name ?? client.contactName ?? "");
    const contactBits  = [
      (raw as any).contact_email ?? client.contactEmail ?? "",
      (raw as any).contact_phone ?? client.contactPhone ?? "",
    ].filter(Boolean);
    const contactFooter = [contactName, contactBits.join("  |  ")].filter(Boolean).join("      ");

    const s = pptx.addSlide({ masterName: "PRODUCT" });

    // Left image (cover the guide box)
    if (imageUrl) {
      try {
        const dataUrl = await urlToDataUrl(imageUrl);
        s.addImage({
          data: strip(dataUrl),
          x: 0.6, y: 0.8, w: 6.3, h: 4.3,
          sizing: { type: "contain", w: 6.3, h: 4.3 },
        });
      } catch { /* leave the guide box visible */ }
    }

    // Right specs: PDF first page OR bullets
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
      } catch { /* fall back to bullets */ }
    }
    if (!specsDrawn && specsBullets && specsBullets.length) {
      addText(s, specsBullets.map((b) => `• ${b}`).join("\n"), {
        x: 7.35, y: 0.95, w: 5.3, h: 4.0, fontSize: 12, color: "334155",
      });
      specsDrawn = true;
    }

    // Center title box text
    addText(s, productName, {
      x: 3.8, y: 5.38, w: 5.8,
      fontSize: Math.min(22, Math.max(16, 26 - Math.max(0, productName.length - 36) * 0.3)),
      bold: true, color: COLOR_SLATE, align: "center",
    });

    // Description (centered line under title)
    if (description) {
      addText(s, `• ${description}`, { x: 3.8, y: 6.2, w: 5.8, fontSize: 12, color: "374151", align: "center" });
    }

    // Product code (left bottom)
    if (productCode) {
      addText(s, productCode, { x: 0.6, y: 6.4, w: 2.0, fontSize: 11, color: COLOR_SLATE });
    }

    // Footer contact text (on the blue bar)
    if (contactFooter) {
      addText(s, contactFooter, { x: 0.7, y: 6.95, w: 12.0, fontSize: 10, color: "FFFFFF" });
    }
  }

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}