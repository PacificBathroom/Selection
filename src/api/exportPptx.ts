// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

/**
 * Export selected products to a PPTX using your layout:
 * - Left: image (from imageUrl)
 * - Right: Name, Description (wrapped), Product code
 * - Specs button: hyperlinks to pdfUrl
 * - Includes cover + back page with contact details
 */
export async function exportSelectionToPptx(opts: {
  client: ClientInfo;
  products: Product[];
  fileName?: string;
}) {
  const { client, products, fileName = "Product-Presentation.pptx" } = opts;

  const pptx = new PptxGenJS();

  // --- Cover ---
  {
    const slide = pptx.addSlide();
    slide.addText(client.projectName || "Project Selection", {
      x: 0.5, y: 1.0, w: 9, h: 1,
      fontSize: 36, bold: true, color: "1F2937",
    });

    const subtitle = [
      client.clientName ? `Client: ${client.clientName}` : "",
      client.dateISO ? `Date: ${client.dateISO}` : "",
    ].filter(Boolean).join("   •   ");

    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.5, y: 1.8, w: 9, h: 0.6,
        fontSize: 18, color: "374151",
      });
    }
  }

  // --- Product slides ---
  for (const p of products) {
    const slide = pptx.addSlide();

    // Left: image or placeholder
    const img = p.imageUrl || p.image;
    if (img) {
      slide.addImage({ path: img, x: 0.5, y: 1.1, w: 4.8, h: 3.6 });
    } else {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: 1.1, w: 4.8, h: 3.6,
        fill: { color: "F3F4F6" },
        line: { color: "D1D5DB", width: 1 },
      });
    }

    // Right: name
    slide.addText(p.name || p.product || "Untitled", {
      x: 5.5, y: 1.1, w: 4.0, h: 0.8,
      fontSize: 24, bold: true, color: "111827",
    });

    // Right: description (auto-wrap in box)
    const desc = p.description || p.specifications || "";
    if (desc) {
      slide.addText(desc, {
        x: 5.5, y: 2.0, w: 4.0, h: 2.0,
        fontSize: 14, color: "374151", valign: "top",
      });
    }

    // Right: product code
    const code = p.code ?? p.sku;
    if (code) {
      slide.addText(`Product code: ${code}`, {
        x: 5.5, y: 4.1, w: 4.0, h: 0.5,
        fontSize: 12, color: "6B7280",
      });
    }

    // Specs button (hyperlink to pdfUrl/specPdfUrl)
    const pdf = p.pdfUrl ?? p.specPdfUrl;
    if (pdf) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 5.5, y: 4.6, w: 1.8, h: 0.6,
        fill: { color: "2563EB" }, line: { color: "1D4ED8", width: 1 },
      });
      slide.addText([{ text: "Specs", options: { color: "FFFFFF", fontSize: 14, bold: true } }], {
        x: 5.5, y: 4.6, w: 1.8, h: 0.6,
        align: "center",
        hyperlink: { url: pdf },
      });
    }
  }

  // --- Back page ---
  {
    const slide = pptx.addSlide();
    slide.addText("Thank you", {
      x: 0.5, y: 1.0, w: 9, h: 1,
      fontSize: 32, bold: true, color: "111827", align: "left",
    });

    const contactLines = [
      client.contactName ? `Contact: ${client.contactName}` : "",
      client.contactEmail ? `Email: ${client.contactEmail}` : "",
      client.contactPhone ? `Phone: ${client.contactPhone}` : "",
    ].filter(Boolean).join("\n");

    if (contactLines) {
      slide.addText(contactLines, {
        x: 0.5, y: 1.8, w: 5.0, h: 1.5,
        fontSize: 16, color: "374151",
      });
    }
  }

  await pptx.writeFile({ fileName });
}

// Keep legacy import working: `import { exportPptx } from "@/api/exportPptx"`
export const exportPptx = exportSelectionToPptx;
