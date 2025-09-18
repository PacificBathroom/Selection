// src/api/exportPptx.ts
import PptxGenJS, { TextPropsOptions } from "pptxgenjs";
import type { Product } from "../types";

/** tiny helper to keep text props tidy */
const H1: TextPropsOptions = {
  fontFace: "Montserrat",
  fontSize: 24,
  bold: true,
  color: "363636",
};
const H2: TextPropsOptions = {
  fontFace: "Montserrat",
  fontSize: 14,
  bold: true,
  color: "555555",
};
const BODY: TextPropsOptions = {
  fontFace: "Inter",
  fontSize: 12,
  color: "333333",
};

function autosizeText(text: string, maxChars = 600): string {
  const s = String(text || "");
  return s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s;
}

/** Make a single product slide matching your placeholder layout */
function addProductSlide(pptx: PptxGenJS, p: Product, contactName?: string) {
  const slide = pptx.addSlide();

  // background
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: "100%",
    fill: { color: "FFFFFF" },
    line: { style: "none" },
  });

  // left: image (from imageUrl)
  if (p.imageUrl) {
    slide.addImage({
      path: p.imageUrl,
      x: 0.3,
      y: 0.6,
      w: 5.0,
      h: 3.6,
      sizing: { type: "contain", w: 5.0, h: 3.6 },
    });
  } else {
    slide.addText("No image", {
      x: 0.3,
      y: 0.6,
      w: 5.0,
      h: 3.6,
      align: "center",
      valign: "middle",
      ...BODY,
    });
  }

  // right: name
  slide.addText(p.name || "Untitled product", {
    x: 5.6,
    y: 0.6,
    w: 4.8,
    h: 0.6,
    ...H1,
  });

  // right: product code
  if (p.code) {
    slide.addText(`Product code: ${p.code}`, {
      x: 5.6,
      y: 1.3,
      w: 4.8,
      h: 0.35,
      ...H2,
    });
  }

  // right: description (autosize-ish via truncation)
  if (p.description) {
    slide.addText(autosizeText(p.description, 1000), {
      x: 5.6,
      y: 1.8,
      w: 4.8,
      h: 2.1,
      valign: "top",
      ...BODY,
    });
  }

  // right: specs box uses PDF preview image — if you only have a link,
  // we put a clickable “Specs” thumbnail.
  if (p.pdfUrl) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 5.6,
      y: 4.1,
      w: 2.4,
      h: 1.6,
      fill: { color: "F2F3F5" },
      line: { style: "none" },
    });
    slide.addText("Specs (PDF)", {
      x: 5.6,
      y: 4.1,
      w: 2.4,
      h: 1.6,
      align: "center",
      valign: "middle",
      hyperlink: { url: p.pdfUrl },
      ...H2,
    });
  }

  // Contact name box (bottom-right)
  if (contactName) {
    slide.addText(`Contact: ${contactName}`, {
      x: 8.2,
      y: 4.2,
      w: 2.2,
      h: 0.5,
      align: "right",
      ...BODY,
    });
  }
}

export async function exportSelectionToPptx(
  opts: {
    products: Product[];
    coverTitle?: string;
    contactName?: string;
  }
): Promise<void> {
  const { products, coverTitle = "Product Selection", contactName } = opts;

  const pptx = new PptxGenJS();

  // cover
  const cover = pptx.addSlide();
  cover.addText(coverTitle, {
    x: 0.8,
    y: 2.5,
    w: 8.5,
    h: 1,
    align: "left",
    ...H1,
    fontSize: 36,
  });

  // each product slide
  for (const p of products) addProductSlide(pptx, p, contactName);

  // back page
  const back = pptx.addSlide();
  back.addText("Thank you", {
    x: 0.8,
    y: 3.0,
    w: 8.5,
    h: 1,
    ...H1,
    fontSize: 32,
  });

  // IMPORTANT: new signature expects options object
  await pptx.writeFile({ fileName: "Product-Presentation.pptx" });
}
