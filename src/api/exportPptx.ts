// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
import type { Product, ClientInfo } from "@/types";

/** Fetch a URL and convert to data: URL so it embeds in PPTX */
async function urlToDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/**
 * Build a PPTX deck with:
 *  - Cover slide (project/client/contact)
 *  - One slide per product (Image, Specs link, Name, Description, Code)
 *  - Back slide (contact details)
 *  Text boxes use shrinkText so long content auto-sizes instead of overflowing.
 */
export async function exportPptx(products: Product[], client: ClientInfo) {
  const pptx = new PptxGenJS();

  // ---------- Cover ----------
  {
    const slide = pptx.addSlide();
    slide.addText("Product Presentation", { x: 0.5, y: 0.5, fontSize: 28, bold: true } as any);
    if (client.projectName) slide.addText(`Project: ${client.projectName}`, { x: 0.5, y: 1.2, fontSize: 20 } as any);
    if (client.clientName) slide.addText(`Client: ${client.clientName}`, { x: 0.5, y: 1.7, fontSize: 18 } as any);

    const contacts: string[] = [];
    if (client.contactName) contacts.push(client.contactName);
    if (client.contactEmail) contacts.push(client.contactEmail);
    if (client.contactPhone) contacts.push(client.contactPhone);
    if (contacts.length) {
      slide.addText(`Contact: ${contacts.join(" • ")}`, { x: 0.5, y: 2.3, fontSize: 14 } as any);
    }
  }

  // Common text styles (cast as any to satisfy older pptxgenjs .d.ts)
  const titleText = { fontSize: 22, bold: true, shrinkText: true } as any;
  const bodyText = { fontSize: 14, shrinkText: true, valign: "top" } as any;

  // ---------- Product slides ----------
  for (const p of products) {
    const slide = pptx.addSlide();

    // Product name (top-left)
    const displayName = p.name ?? p.product?.name;
    if (displayName) {
      slide.addText(displayName, { x: 0.5, y: 0.3, w: 4.6, h: 0.6, ...titleText } as any);
    }

    // Product code
    const displayCode = p.code ?? p.product?.code;
    if (displayCode) {
      slide.addText(`Code: ${displayCode}`, {
        x: 0.5,
        y: 1.0,
        w: 4.6,
        h: 0.4,
        fontSize: 14,
        italic: true,
        shrinkText: true,
      } as any);
    }

    // Description (left column)
    const desc = p.description ?? p.product?.description;
    if (desc) {
      slide.addText(desc, { x: 0.5, y: 1.6, w: 4.6, h: 3.2, ...bodyText } as any);
    }

    // Image box (right top) ← imageurl
    const imgData = await urlToDataUrl(p.imageUrl || p.image || p.product?.imageUrl || p.product?.image);
    if (imgData) {
      slide.addImage({ data: imgData, x: 5.3, y: 0.5, w: 4.0, h: 3.0 } as any);
    }

    // SPECS area (right bottom) ← link to PDF
    const pdfUrl = p.pdfUrl || p.specPdfUrl || p.product?.pdfUrl || p.product?.specPdfUrl;
    if (pdfUrl) {
      slide.addText("View Specs", {
        x: 5.3,
        y: 3.7,
        w: 4.0,
        h: 0.5,
        fontSize: 12,
        color: "0070C0",
        underline: true,
        hyperlink: { url: pdfUrl },
      } as any);
    }
  }

  // ---------- Back ----------
  {
    const slide = pptx.addSlide();
    slide.addText("Thank you", { x: 0.5, y: 0.6, fontSize: 26, bold: true } as any);
    const parts: string[] = [];
    if (client.contactName) parts.push(client.contactName);
    if (client.contactEmail) parts.push(client.contactEmail);
    if (client.contactPhone) parts.push(client.contactPhone);
    if (parts.length) {
      slide.addText(parts.join("   •   "), { x: 0.5, y: 1.4, fontSize: 14 } as any);
    }
  }

  await pptx.writeFile({ fileName: "Product-Presentation.pptx" } as any);
}
