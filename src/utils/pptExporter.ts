// src/utils/pptExporter.ts

// @ts-ignore - pptxgenjs ships default export in this build
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/** If URL is external, route via our proxy to avoid CORS issues */
const viaProxy = (u?: string | null) =>
  u && /^https?:\/\//i.test(u) ? `/api/pdf-proxy?url=${encodeURIComponent(u)}` : u || undefined;

async function urlToDataUrl(u: string): Promise<string> {
  const res = await fetch(viaProxy(u)!, { credentials: "omit" });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${u}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
const strip = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

/** Export slides directly from a flat list of products (no sections) */
export async function exportDeckFromProducts({
  client,
  products,
}: {
  client: ClientInfo;
  products: Product[];
}) {
  const pptx = new PptxGenJS();
  pptx.layout = "A4"; // 8.27 x 11.69 in

  // ---------- Cover ----------
  {
    const slide = pptx.addSlide();
    slide.addText("SELECTION DECK", { x: 0.5, y: 0.4, w: 7.3, fontSize: 12, bold: true, color: "666666" });
    slide.addText(client.projectName || "Project Selection", { x: 0.5, y: 0.9, w: 7.3, fontSize: 32, bold: true, color: "0F172A" });
    slide.addText(`Prepared for ${client.clientName || "Client name"}`, { x: 0.5, y: 1.6, w: 7.3, fontSize: 14, color: "334155" });
    const dateStr = client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString();
    slide.addText(dateStr, { x: 0.5, y: 1.95, w: 7.3, fontSize: 12, color: "64748B" });
    slide.addImage({ path: "/logo.png", x: 1.65, y: 2.7, w: 5.0, h: 2.3 });
  }

  // ---------- One slide per product ----------
  for (const p of products) {
    const slide = pptx.addSlide();

    // Map your sheet columns to variables (with safe fallbacks)
    const productName = String((p.product ?? p.name ?? "Product") || "");
    const productCode = String(p.code ?? p.Code ?? p.sku ?? "");
    const imageUrl = (p.thumbnail as string) || (p.Image as string) || (p.image as string) || "";
    const pdfUrl = (p["pdf_url"] as string) || (p["PDF URL"] as string) || (p.specPdfUrl as string) || "";
    const description = String((p.description ?? p.Description ?? "") || "");
    const contactName = String((p["Contact Name"] ?? p.contact_name ?? "") || "");
    const contactDetails = String((p["Contact Details"] ?? "") || "");

    // --- Layout like your mock ---
    // Top: IMAGE_BOX (left) and SPECS preview (right)
    const imgLeftX = 0.6;
    const imgTopY = 0.8;
    const imgW = 4.2;
    const imgH = 3.5;

    if (imageUrl) {
      try {
        const dataUrl = await urlToDataUrl(imageUrl);
        slide.addImage({ data: strip(dataUrl), x: imgLeftX, y: imgTopY, w: imgW, h: imgH, sizing: { type: "contain", w: imgW, h: imgH } });
      } catch {}
    } else {
      // light placeholder box so it still looks structured
      slide.addShape(pptx.ShapeType.rect, {
        x: imgLeftX,
        y: imgTopY,
        w: imgW,
        h: imgH,
        line: { color: "C7D2FE" },
        fill: { color: "F8FAFC" },
      });
      slide.addText("[[IMAGE_BOX]]", { x: imgLeftX + 0.15, y: imgTopY + 0.15, fontSize: 10, color: "9CA3AF" });
    }

    // Right: SPECS = first page of PDF
    const specsX = 5.1;
    const specsY = 0.8;
    const specsW = 2.6;
    const specsH = 3.5;

    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1200);
        slide.addImage({ data: strip(png), x: specsX, y: specsY, w: specsW, h: specsH, sizing: { type: "contain", w: specsW, h: specsH } });
      } catch {
        slide.addShape(pptx.ShapeType.rect, { x: specsX, y: specsY, w: specsW, h: specsH, line: { color: "C7D2FE" }, fill: { color: "F8FAFC" } });
        slide.addText("([[SPECS]])", { x: specsX + 0.15, y: specsY + 0.15, fontSize: 10, color: "9CA3AF" });
      }
    } else {
      slide.addShape(pptx.ShapeType.rect, { x: specsX, y: specsY, w: specsW, h: specsH, line: { color: "C7D2FE" }, fill: { color: "F8FAFC" } });
      slide.addText("([[SPECS]])", { x: specsX + 0.15, y: specsY + 0.15, fontSize: 10, color: "9CA3AF" });
    }

    // Product name in a box centered-ish (like your mock)
    slide.addShape(pptx.ShapeType.rect, {
      x: 2.0,
      y: 4.5,
      w: 4.0,
      h: 0.85,
      line: { color: "9CA3AF" },
      fill: { color: "FFFFFF" },
    });
    slide.addText(productName, { x: 2.1, y: 4.62, w: 3.8, fontSize: 16, bold: true, color: "0F172A", align: "center" });

    // Description bullets under the name box
    if (description) {
      slide.addText(`• ${description}`, { x: 2.1, y: 5.45, w: 3.8, fontSize: 12, color: "374151" });
    }

    // Left gutter: PRODUCT_CODE
    if (productCode) {
      slide.addText(productCode, { x: 0.6, y: 4.45, w: 1.3, fontSize: 11, color: "0F172A" });
    }

    // Bottom blue bar with contact name + contact details
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5,
      y: 6.5,
      w: 7.3,
      h: 0.35,
      fill: { color: "1D4ED8" }, // brand blue
      line: { color: "1D4ED8" },
    });

    const bottomText = [
      contactName || client.contactName || "",
      contactDetails || [client.contactEmail, client.contactPhone].filter(Boolean).join("  |  "),
    ];

    slide.addText(bottomText.filter(Boolean).join("      "), {
      x: 0.7,
      y: 6.56,
      w: 6.9,
      fontSize: 10,
      color: "FFFFFF",
    });
  }

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}
