// src/api/exportPptx.ts
// Uses PptxGenJS to export slides with product + app info

// @ts-ignore
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

// helper: fetch image as dataURL (so it embeds)
async function urlToDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

// helper: render PDF first page as image
async function pdfToImage(url: string): Promise<string | undefined> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    const pdf = await pdfjsLib.getDocument(url).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
}

/**
 * Export products into a PPTX
 */
export async function exportPptx(
  products: Product[],
  client: ClientInfo
) {
  const pptx = new PptxGenJS();

  // --- Cover slide ---
  const cover = pptx.addSlide();
  cover.addText(`Product Presentation for ${client.projectName ?? ""}`, {
    x: 0.5, y: 0.5, fontSize: 28, bold: true,
  });
  cover.addText(`${client.clientName ?? ""}`, {
    x: 0.5, y: 1.2, fontSize: 20,
  });
  cover.addText(`Your Pacific Bathroom Contact: ${client.contactName ?? ""}`, {
    x: 0.5, y: 2.0, fontSize: 16,
  });
  if (client.contactEmail) {
    cover.addText(client.contactEmail, { x: 0.5, y: 2.5, fontSize: 14 });
  }
  if (client.contactPhone) {
    cover.addText(client.contactPhone, { x: 0.5, y: 2.9, fontSize: 14 });
  }

  // --- Product slides ---
  for (const p of products) {
    const slide = pptx.addSlide();

    // Product Name
    if (p.name) {
      slide.addText(p.name, {
        x: 0.5, y: 0.3, w: 4, h: 0.5,
        fontSize: 20, bold: true,
        shrinkText: true, // auto-shrink if too long
      });
    }

    // Product Code
    if (p.code) {
      slide.addText(`Code: ${p.code}`, {
        x: 0.5, y: 0.9, w: 4, h: 0.4,
        fontSize: 14, italic: true,
        shrinkText: true,
      });
    }

    // Description
    if (p.description) {
      slide.addText(p.description, {
        x: 0.5, y: 1.5, w: 4.5, h: 3,
        fontSize: 14,
        valign: "top",
        shrinkText: true, // ensures text stays inside box
      });
    }

    // Image (from URL)
    if (p.imageUrl) {
      const imgData = await urlToDataUrl(p.imageUrl);
      if (imgData) {
        slide.addImage({ data: imgData, x: 5.2, y: 0.5, w: 4, h: 3 });
      }
    }

    // Specs (PDF preview)
    if (p.pdfUrl) {
      const pdfImg = await pdfToImage(p.pdfUrl);
      if (pdfImg) {
        slide.addImage({ data: pdfImg, x: 5.2, y: 3.7, w: 4, h: 2.5 });
      } else {
        // fallback: just add a clickable text link
        slide.addText("View Specs", {
          x: 5.2, y: 3.7, w: 4, h: 0.5,
          fontSize: 12, color: "0070C0", underline: true,
          hyperlink: { url: p.pdfUrl },
        });
      }
    }
  }

  // --- Back slide ---
  const back = pptx.addSlide();
  back.addText("Thank you", { x: 3, y: 1, fontSize: 28, bold: true });
  back.addText(`Contact: ${client.contactName ?? ""}`, {
    x: 3, y: 2, fontSize: 18,
  });
  if (client.contactEmail) {
    back.addText(client.contactEmail, { x: 3, y: 2.5, fontSize: 14 });
  }
  if (client.contactPhone) {
    back.addText(client.contactPhone, { x: 3, y: 3.0, fontSize: 14 });
  }

  // Save file
  await pptx.writeFile("Product-Presentation.pptx");
}
