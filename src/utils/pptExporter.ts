// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* ---------- helpers: base64 proxy + fetch-to-dataURL (single copy) ---------- */
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

/* ------------------------------ exporter ------------------------------ */
export async function exportDeckFromProducts({
  client,
  products,
}: {
  client: ClientInfo;
  products: Product[];
}) {
  const pptx = new PptxGenJS();

  // A4 across versions
  let set = false;
  try { (pptx as any).layout = "LAYOUT_A4"; set = true; } catch {}
  if (!set) { try { (pptx as any).layout = "A4"; set = true; } catch {} }
  if (!set && (pptx as any).defineLayout) {
    (pptx as any).defineLayout({ name: "A4", width: 8.27, height: 11.69 });
    (pptx as any).layout = "A4";
  }

  // Cover
  {
    const slide = pptx.addSlide();
    slide.addText("SELECTION DECK", { x: 0.5, y: 0.45, w: 7.3, fontSize: 12, bold: true, color: "666666" });
    slide.addText(client.projectName || "Project Selection", { x: 0.5, y: 0.95, w: 7.3, fontSize: 32, bold: true, color: "0F172A" });
    slide.addText(`Prepared for ${client.clientName || "Client name"}`, { x: 0.5, y: 1.65, w: 7.3, fontSize: 14, color: "334155" });
    slide.addText(client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString(), { x: 0.5, y: 2.0, w: 7.3, fontSize: 12, color: "64748B" });
    slide.addImage({ path: "/logo.png", x: 1.65, y: 2.7, w: 5.0, h: 2.3 });
  }

  // Product slides
  for (const raw of products) {
    const productName = String((raw as any).product ?? (raw as any).name ?? "Product");
    const productCode = String((raw as any).sku ?? (raw as any).code ?? "");
    const imageUrl = String((raw as any).thumbnail ?? (raw as any).imageurl ?? (raw as any).image ?? "");
    const pdfUrl = String((raw as any).pdf_url ?? (raw as any).pdfurl ?? "");
    const description = String((raw as any).description ?? "");
    const specsBullets = (raw as any).specs as string[] | undefined;
    const contactName = String((raw as any).contact_name ?? client.contactName ?? "");
    const contactDetails = [
      (raw as any).contact_email ?? client.contactEmail ?? "",
      (raw as any).contact_phone ?? client.contactPhone ?? "",
    ].filter(Boolean).join("  |  ");

    const slide = pptx.addSlide();

    // Image (left)
    const imgX = 0.6, imgY = 0.8, imgW = 4.2, imgH = 3.5;
    if (imageUrl) {
      try {
        const dataUrl = await urlToDataUrl(imageUrl);
        slide.addImage({ data: strip(dataUrl), x: imgX, y: imgY, w: imgW, h: imgH, sizing: { type: "contain", w: imgW, h: imgH } });
      } catch {
        slide.addShape(pptx.ShapeType.rect, { x: imgX, y: imgY, w: imgW, h: imgH, line: { color: "C7D2FE" }, fill: { color: "F8FAFC" } });
      }
    } else {
      slide.addShape(pptx.ShapeType.rect, { x: imgX, y: imgY, w: imgW, h: imgH, line: { color: "C7D2FE" }, fill: { color: "F8FAFC" } });
    }

    // Specs (right): prefer PDF page; fallback to bullets; else placeholder
    const specsX = 5.1, specsY = 0.8, specsW = 2.6, specsH = 3.5;
    let specsShown = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1200);
        slide.addImage({ data: strip(png), x: specsX, y: specsY, w: specsW, h: specsH, sizing: { type: "contain", w: specsW, h: specsH } });
        specsShown = true;
      } catch {}
    }
    if (!specsShown && specsBullets && specsBullets.length) {
      slide.addShape(pptx.ShapeType.rect, { x: specsX, y: specsY, w: specsW, h: specsH, line: { color: "C7D2FE" }, fill: { color: "FFFFFF" } });
      slide.addText(
        specsBullets.map((b) => `• ${b}`).join("\n"),
        { x: specsX + 0.15, y: specsY + 0.15, w: specsW - 0.3, h: specsH - 0.3, fontSize: 11, color: "334155" }
      );
      specsShown = true;
    }
    if (!specsShown) {
      slide.addShape(pptx.ShapeType.rect, { x: specsX, y: specsY, w: specsW, h: specsH, line: { color: "C7D2FE" }, fill: { color: "F8FAFC" } });
    }

    // Name box (center)
    slide.addShape(pptx.ShapeType.rect, { x: 2.0, y: 4.55, w: 4.0, h: 0.85, line: { color: "9CA3AF" }, fill: { color: "FFFFFF" } });
    slide.addText(productName, { x: 2.1, y: 4.67, w: 3.8, fontSize: 16, bold: true, color: "0F172A", align: "center" });

    // Description
    if (description) {
      slide.addText(`• ${description}`, { x: 2.1, y: 5.50, w: 3.8, fontSize: 12, color: "374151" });
    }

    // Product code (left gutter)
    if (productCode) {
      slide.addText(productCode, { x: 0.6, y: 4.50, w: 1.3, fontSize: 11, color: "0F172A" });
    }

    // Footer (blue) with contact
    slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 6.5, w: 7.3, h: 0.35, fill: { color: "1D4ED8" }, line: { color: "1D4ED8" } });
    const footer = [contactName, contactDetails].filter(Boolean).join("      ");
    if (footer) slide.addText(footer, { x: 0.7, y: 6.56, w: 6.9, fontSize: 10, color: "FFFFFF" });
  }

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}