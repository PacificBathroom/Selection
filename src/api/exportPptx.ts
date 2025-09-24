// src/api/exportPptx.ts
import type { Product } from "../types";

const FULL_W = 10;       // pptxgenjs 16:9 width (inches)
const FULL_H = 5.625;    // pptxgenjs 16:9 height

const title = (s?: string) => (s ?? "").trim() || "—";

async function blobToDataUrl(b: Blob): Promise<string> {
  return await new Promise((res) => {
    const r = new FileReader();
    r.onloadend = () => res(String(r.result));
    r.readAsDataURL(b);
  });
}
async function urlToDataUrl(url: string): Promise<string> {
  const r = await fetch(url, { cache: "no-store" });
  const b = await r.blob();
  return blobToDataUrl(b);
}

export type ExportMeta = {
  projectName?: string;
  clientName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  date?: string;
};

export async function exportPptx(selectedList: Product[], meta: ExportMeta = {}) {
  if (!selectedList.length) return;

  const {
    projectName = "Project Selection",
    clientName = "",
    contactName = "",
    email = "",
    phone = "",
    date = "",
  } = meta;

  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // -------- COVERS (two bathroom photos) --------
  for (const url of ["/pptx/cover1.jpg", "/pptx/cover2.jpg"]) {
    try {
      const dataUrl = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch {}
  }

  // Optional title/about slide
  pptx.addSlide().addText(
    [
      { text: projectName, options: { fontSize: 28, bold: true } },
      { text: clientName ? `\nClient: ${clientName}` : "", options: { fontSize: 18 } },
      { text: contactName ? `\nPrepared by: ${contactName}` : "", options: { fontSize: 16 } },
      { text: email ? `\nEmail: ${email}` : "", options: { fontSize: 14 } },
      { text: phone ? `\nPhone: ${phone}` : "", options: { fontSize: 14 } },
      { text: date ? `\nDate: ${date}` : "", options: { fontSize: 14 } },
    ],
    { x: 0.6, y: 0.6, w: 12, h: 6 }
  );

  // -------- PRODUCT SLIDES --------
  for (const p of selectedList) {
    const s = pptx.addSlide();

    // image
    try {
      if (p.imageProxied) {
        const dataUrl = await urlToDataUrl(p.imageProxied);
        s.addImage({ data: dataUrl, x: 0.5, y: 0.7, w: 5.5, h: 4.1, sizing: { type: "contain", w: 5.5, h: 4.1 } } as any);
      }
    } catch {}

    // name + sku
    s.addText(title(p.name), { x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true });
    s.addText(p.code ? `SKU: ${p.code}` : "", { x: 6.2, y: 1.4, w: 6.2, h: 0.4, fontSize: 12 });

    // description + bullet specs + category
    const lines: string[] = [];
    if (p.description) lines.push(p.description);
    if (p.specsBullets?.length) lines.push("• " + p.specsBullets.join("\n• "));
    if (p.category) lines.push(`\nCategory: ${p.category}`);
    s.addText(lines.join("\n"), { x: 6.2, y: 1.9, w: 6.2, h: 3.7, fontSize: 12 });

    // links
    if (p.url)
      s.addText("Product page", {
        x: 6.2, y: 5.8, w: 6.2, h: 0.4, fontSize: 12, underline: true, hyperlink: { url: p.url }
      });
    if (p.pdfUrl)
      s.addText("Spec sheet (PDF)", {
        x: 6.2, y: 6.2, w: 6.2, h: 0.4, fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl }
      });
  }

  // -------- BACK PAGES --------
  for (const url of ["/pptx/warranty.jpg", "/pptx/service.jpg"]) {
    try {
      const dataUrl = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch {}
  }

  const filename = `${(projectName || "Selection").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
