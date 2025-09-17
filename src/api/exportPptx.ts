// src/api/exportPptx.ts
import PptxGenJS, { TextProps } from "pptxgenjs";
import type { Product, ClientInfo } from "../types";

/** fetch as DataURL so images embed into PPTX */
async function urlToDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url, { mode: "cors" });
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

/** Try to render the first page of a PDF to an image dataURL */
async function pdfFirstPageToPngDataUrl(pdfUrl?: string): Promise<string | undefined> {
  if (!pdfUrl) return undefined;
  try {
    // dynamic import so it only runs in the browser
    const pdfjs: any = await import("pdfjs-dist/build/pdf");
    // In some bundlers we may need a worker, but try without first:
    // pdfjs.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js'; // optional if needed

    const loadingTask = pdfjs.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 1.3 });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/png");
  } catch {
    // fallback will be a hyperlink text
    return undefined;
  }
}

/**
 * Export products into a PPTX deck with:
 *  - Cover slide (project/client/contact)
 *  - One slide per product:
 *      Image box  <- product.imageUrl
 *      Specs area <- first page of product.pdfUrl rendered as image (fallback: link)
 *      Product name <- product.name
 *      Description  <- product.description (auto-shrink)
 *      Product code <- product.code
 *  - Back slide with contact details
 */
export async function exportPptx(products: Product[], client: ClientInfo) {
  const pptx = new PptxGenJS();

  // -------- Cover slide --------
  {
    const slide = pptx.addSlide();
    slide.addText(`Product Presentation`, {
      x: 0.5, y: 0.5, fontSize: 28, bold: true,
    });
    if (client.projectName) {
      slide.addText(`Project: ${client.projectName}`, {
        x: 0.5, y: 1.2, fontSize: 20,
      });
    }
    if (client.clientName) {
      slide.addText(`Client: ${client.clientName}`, {
        x: 0.5, y: 1.7, fontSize: 18,
      });
    }
    const contacts: string[] = [];
    if (client.contactName) contacts.push(client.contactName);
    if (client.contactEmail) contacts.push(client.contactEmail);
    if (client.contactPhone) contacts.push(client.contactPhone);
    if (contacts.length) {
      slide.addText(`Contact: ${contacts.join(" • ")}`, {
        x: 0.5, y: 2.3, fontSize: 14,
      });
    }
  }

  // Common text styling with auto-shrink
  const titleTextProps: TextProps = { fontSize: 22, bold: true, shrinkText: true };
  const bodyTextProps: TextProps = { fontSize: 14, shrinkText: true, valign: "top" as const };

  // -------- Product slides --------
  for (const p of products) {
    const slide = pptx.addSlide();

    // Product name (top-left)
    if (p.name) {
      slide.addText(p.name, { x: 0.5, y: 0.3, w: 4.6, h: 0.6, ...titleTextProps });
    }

    // Product code (under title)
    if (p.code) {
      slide.addText(`Code: ${p.code}`, { x: 0.5, y: 1.0, w: 4.6, h: 0.4, fontSize: 14, italic: true, shrinkText: true });
    }

    // Description (left column)
    if (p.description) {
      slide.addText(p.description, { x: 0.5, y: 1.6, w: 4.6, h: 3.2, ...bodyTextProps });
    }

    // Image box (right top) ← imageurl
    const mainImg = await urlToDataUrl(p.imageUrl || p.image);
    if (mainImg) {
      slide.addImage({ data: mainImg, x: 5.3, y: 0.5, w: 4.0, h: 3.0 });
    }

    // SPECS area (right bottom) ← first page of PDF as image (fallback hyperlink)
    if (p.pdfUrl || p.specPdfUrl) {
      const pdfImg = await pdfFirstPageToPngDataUrl(p.pdfUrl || p.specPdfUrl);
      if (pdfImg) {
        slide.addImage({ data: pdfImg, x: 5.3, y: 3.7, w: 4.0, h: 2.5 });
      } else if (p.pdfUrl || p.specPdfUrl) {
        slide.addText("View Specs", {
          x: 5.3, y: 3.7, w: 4.0, h: 0.5,
          fontSize: 12, color: "0070C0", underline: true,
          hyperlink: { url: (p.pdfUrl || p.specPdfUrl)! },
        });
      }
    }
  }

  // -------- Back slide --------
  {
    const slide = pptx.addSlide();
    slide.addText("Thank you", { x: 0.5, y: 0.6, fontSize: 26, bold: true });
    const parts: string[] = [];
    if (client.contactName) parts.push(client.contactName);
    if (client.contactEmail) parts.push(client.contactEmail);
    if (client.contactPhone) parts.push(client.contactPhone);
    if (parts.length) {
      slide.addText(parts.join("   •   "), { x: 0.5, y: 1.4, fontSize: 14 });
    }
  }

  await pptx.writeFile({ fileName: "Product-Presentation.pptx" });
}
