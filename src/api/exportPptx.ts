// src/api/exportPptx.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

/**
 * Export a set of products into a PowerPoint file using pptxgenjs v3+
 */
export async function exportSelectionToPptx(
  client: ClientInfo,
  products: Product[]
) {
  const pptx = new PptxGenJS();

  // --- COVER SLIDE ---
  const cover = pptx.addSlide();
  cover.addText(
    [{ text: client.projectName || "Project Selection", options: { bold: true, fontSize: 36 } }],
    { x: 1, y: 2, w: 8, h: 1 }
  );
  cover.addText(
    [{ text: `Client: ${client.clientName ?? ""}`, options: { fontSize: 18 } }],
    { x: 1, y: 3.2, w: 8, h: 0.5 }
  );
  cover.addText(
    [{ text: `Contact: ${client.contactName ?? ""}`, options: { fontSize: 18 } }],
    { x: 1, y: 3.8, w: 8, h: 0.5 }
  );

  // --- PRODUCT SLIDES ---
  for (const product of products) {
    const slide = pptx.addSlide();

    // Product Image
    if (product.imageUrl) {
      slide.addImage({
        path: product.imageUrl,
        x: 0.5,
        y: 0.5,
        w: 3,
        h: 3,
      });
    }

    // Specs (PDF preview as image placeholder)
    if (product.specPdfUrl) {
      slide.addImage({
        path: product.specPdfUrl,
        x: 4,
        y: 0.5,
        w: 5,
        h: 3,
      });
    }

    // Product Name
    slide.addText(
      [{ text: product.name ?? "", options: { bold: true, fontSize: 24 } }],
      { x: 0.5, y: 4, w: 8.5, h: 0.6 }
    );

    // Description (autosize by setting fit = true)
    if (product.description) {
      slide.addText(
        [{ text: product.description, options: { fontSize: 14 } }],
        { x: 0.5, y: 4.8, w: 8.5, h: 2, fit: true }
      );
    }

    // Product Code
    if (product.code) {
      slide.addText(
        [{ text: `Code: ${product.code}`, options: { italic: true, fontSize: 12 } }],
        { x: 0.5, y: 7, w: 8.5, h: 0.4 }
      );
    }
  }

  // --- BACK SLIDE ---
  const back = pptx.addSlide();
  back.addText(
    [{ text: "Thank you", options: { bold: true, fontSize: 28 } }],
    { x: 3, y: 3, w: 4, h: 1 }
  );

  // --- SAVE ---
  const filename = `${client.projectName || "selection"}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
