// src/api/exportPptx.ts
import PptxGenJS, { Slide } from "pptxgenjs";
import type { Product } from "../types";

// ---------- helpers ----------
function isLikelyImageUrl(u: string) {
  return /\.(png|jpe?g|gif|webp|bmp|tiff?)($|\?)/i.test(u);
}

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const blob = await res.blob();
  const buf = await blob.arrayBuffer();
  // Browser-safe base64 encode
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${blob.type};base64,${btoa(binary)}`;
}

/** crude “auto-size”: shrink font as text grows */
function pickFontSize(text: string, maxLen = 380, base = 14) {
  if (!text) return base;
  if (text.length <= maxLen) return base;
  // shrink down to 10 if really long
  const over = text.length - maxLen;
  const steps = Math.min(4, Math.ceil(over / 200)); // each ~200 chars → -1pt
  return Math.max(10, base - steps);
}

// ---------- slide builders (coordinates are in inches) ----------
function addCoverSlide(ppt: PptxGenJS, opts: {
  projectName?: string;
  clientName?: string;
  contactName?: string;
  logoUrl?: string;
}) {
  const s = ppt.addSlide({ sectionTitle: "Cover" });

  s.addText("Product Selection", { x: 0.6, y: 0.7, w: 9.2, h: 0.8, fontSize: 36, bold: true });

  if (opts.logoUrl) {
    s.addImage({ path: opts.logoUrl, x: 8.2, y: 0.5, w: 1.6, h: 0.7 });
  }

  const y = 2.1;
  s.addText(
    [
      { text: "Project: ", bold: true },
      { text: opts.projectName || "—" },
      { text: "\nClient: ", bold: true },
      { text: opts.clientName || "—" },
      { text: "\nContact: ", bold: true },
      { text: opts.contactName || "—" },
    ],
    { x: 0.8, y, w: 8.8, h: 1.2, fontSize: 16, lineSpacing: 24 }
  );
}

function addBackSlide(ppt: PptxGenJS, opts: { contactName?: string }) {
  const s = ppt.addSlide({ sectionTitle: "Back" });
  s.addText("Thank you!", { x: 0.6, y: 1, w: 9.2, h: 0.8, fontSize: 34, bold: true });
  if (opts.contactName) {
    s.addText(`Prepared by: ${opts.contactName}`, {
      x: 0.6, y: 2, w: 9.2, h: 0.5, fontSize: 16,
    });
  }
}

// This matches your mock layout:
//  - Title centered top
//  - Big image box on the right
//  - Description box bottom center
//  - Product code bottom-left
//  - “Specs” area on the top-right beside the image (link or image)
async function addProductSlide(ppt: PptxGenJS, p: Product, contactName?: string) {
  const s = ppt.addSlide();

  // Title ({{PRODUCT_NAME}})
  s.addText(p.product || "", { x: 0.7, y: 0.6, w: 8.8, h: 0.6, fontSize: 22, bold: true });

  // IMAGE BOX ({{IMAGE_BOX}}) – big box on the right
  // Try product.imageUrl or thumbnail
  const imgUrl = String(p.imageUrl || p.thumbnail || "");
  if (imgUrl) {
    try {
      const b64 = await urlToBase64(imgUrl);
      s.addImage({ data: b64, x: 6.1, y: 1.3, w: 4.1, h: 3.6 });
    } catch {
      // show a light placeholder rectangle if image fails
      s.addShape(ppt.ShapeType.rect, { x: 6.1, y: 1.3, w: 4.1, h: 3.6, fill: { color: "F3F4F6" } });
      s.addText("Image not available", { x: 6.2, y: 2.9, w: 3.9, h: 0.4, fontSize: 12, color: "777" });
    }
  } else {
    s.addShape(ppt.ShapeType.rect, { x: 6.1, y: 1.3, w: 4.1, h: 3.6, fill: { color: "F3F4F6" } });
  }

  // SPECS ({{SPECS}}) – top-right corner area
  const pdfUrl = String(p.pdfUrl || (p as any).pdf_url || "");
  if (pdfUrl) {
    if (isLikelyImageUrl(pdfUrl)) {
      // if the "PDFUrl" cell actually has an image URL, show it as the "spec image"
      try {
        const b64 = await urlToBase64(pdfUrl);
        s.addImage({ data: b64, x: 6.1, y: 0.9, w: 1.8, h: 0.9 });
      } catch {
        s.addText("View Specifications", {
          x: 6.1, y: 0.9, w: 2.6, h: 0.4, fontSize: 12, color: "0088FF",
          underline: true, hyperlink: { url: pdfUrl },
        });
      }
    } else {
      // show a clickable link tile
      s.addShape(ppt.ShapeType.roundRect, {
        x: 6.1, y: 0.9, w: 3.8, h: 0.5, fill: { color: "E8F2FF" }, line: { color: "88B8FF" },
      });
      s.addText("View Specifications", {
        x: 6.1, y: 0.9, w: 3.8, h: 0.5, fontSize: 12, color: "0066CC", align: "center",
        hyperlink: { url: pdfUrl },
      });
    }
  }

  // DESCRIPTION ({{DESCRIPTION}}) – auto-shrinks font when long
  const desc = String(p.description || "");
  const descSize = pickFontSize(desc, 380, 14);
  s.addText(desc, {
    x: 1.0, y: 5.1, w: 8.8, h: 1.0, fontSize: descSize, valign: "top",
  });

  // PRODUCT CODE ({{PRODUCT_CODE}})
  const code = String(p.sku || p.code || "");
  if (code) {
    s.addText(code, { x: 4.4, y: 6.25, w: 2.2, h: 0.35, fontSize: 12, align: "center" });
  }

  // FOOTER BAR (contact)
  s.addShape(ppt.ShapeType.rect, { x: 0, y: 6.6, w: 10, h: 0.35, fill: { color: "0B67B1" } });
  s.addText(contactName ? contactName : "", {
    x: 0.4, y: 6.63, w: 4.0, h: 0.3, fontSize: 11, color: "FFFFFF",
  });
}

// ---------- public API ----------
export async function exportSelectionToPptx(args: {
  products: Product[];
  client?: {
    projectName?: string;
    clientName?: string;
    contactName?: string;
  };
  logoUrl?: string; // optional small logo for the cover
  fileName?: string;
}) {
  const { products, client, logoUrl } = args;
  const fileName = args.fileName || "Product-Presentation.pptx";

  const ppt = new PptxGenJS();
  ppt.layout = "LAYOUT_WIDE"; // 16:9

  // Cover
  addCoverSlide(ppt, {
    projectName: client?.projectName,
    clientName: client?.clientName,
    contactName: client?.contactName,
    logoUrl,
  });

  // Each product
  for (const p of products) {
    await addProductSlide(ppt, p, client?.contactName);
  }

  // Back
  addBackSlide(ppt, { contactName: client?.contactName });

  await ppt.writeFile({ fileName });
}
