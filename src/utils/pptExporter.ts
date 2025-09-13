// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* =====================  STYLE  ===================== */
const FONT = "Calibri";
const COLOR_TEXT = "0F172A";
const COLOR_SUB = "334155";
const COLOR_MUTED = "64748B";
const COLOR_FOOTER = "2EC7C0"; // turquoise

/* =====================  GEOMETRY (16:9)  =====================
   16:9 slide is ~13.33 x 7.5 inches
*/
const SLIDE = { w: 13.33, h: 7.5 };

// product layout
const PRODUCT = {
  // top title
  title: { x: 0.7, y: 0.35, w: 11.9, h: 0.6 },
  // left image
  img: { x: 0.7, y: 1.1, w: 6.2, h: 3.9 },
  // right spec (pdf preview OR bullets)
  specs: { x: 7.1, y: 1.1, w: 5.5, h: 3.9 },
  // description just above footer
  desc: { x: 0.7, y: 5.25, w: 11.9, h: 0.8 },
  // code line under description
  code: { x: 0.7, y: 6.05, w: 11.9, h: 0.5 },
  // footer bar + text
  footerBar: { x: 0, y: 6.8, w: 13.33, h: 0.45 },
  footerText: { x: 1.4, y: 6.87, w: 11.5, h: 0.35 },
};

/* =====================  HELPERS  ===================== */

// addText with safe defaults (autoshrink, no trailing para space)
const addText = (s: any, text: string | undefined, opts: any) => {
  const t = (text ?? "").toString().trim();
  if (!t) return;
  s.addText(t, {
    fontFace: FONT,
    autoFit: true,
    paraSpaceAfter: 0,
    ...opts,
  });
};

// remove data: prefix
const stripDataPrefix = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

/**
 * Prefer local assets (served by Netlify from /public) and only proxy real external URLs.
 * - Local examples: /assets/products/foo.jpg  |  /assets/products/foo.pdf
 * - External gets proxied: https://site.com/file.pdf  ->  /api/pdf-proxy?url=…
 */
const viaProxy = (u?: string | null): string | undefined => {
  const s = (u ?? "").toString().trim();
  if (!s) return undefined;
  if (s.startsWith("/")) return s; // local asset – serve directly
  if (/^https?:\/\//i.test(s)) return `/api/pdf-proxy?url=${encodeURIComponent(s)}`;
  return undefined;
};

// fetch any URL (local path or proxied external) as data URL
async function fetchAsDataUrl(u: string): Promise<string> {
  const resolved = viaProxy(u);
  if (!resolved) throw new Error(`Bad URL: ${u}`);
  const res = await fetch(resolved, { credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// try a series of field names against a product row
const pick = (row: any, keys: string[], fallback = ""): string => {
  for (const k of keys) {
    const v =
      row?.[k] ??
      row?.[k.toLowerCase?.()] ??
      row?.[k.replace(/\s+/g, "")] ??
      row?.[k.replace(/[_-]+/g, "")];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return fallback;
};

// dynamic title size to help prevent overflow
const titleSize = (name: string) => {
  const n = (name || "").length;
  if (n <= 28) return 28;
  if (n <= 40) return 24;
  if (n <= 56) return 22;
  if (n <= 72) return 20;
  return 18;
};

/* =====================  MAIN EXPORTER  ===================== */
export async function exportDeckFromProducts({
  client,
  products,
}: {
  client: ClientInfo;
  products: Product[];
}) {
  const pptx = new PptxGenJS();
  (pptx as any).layout = "LAYOUT_16x9";

  // ====== Masters (backgrounds locked) ======
  pptx.defineSlideMaster({
    title: "COVER1",
    objects: [{ image: { path: "/cover-bg-1.png", x: 0, y: 0, w: SLIDE.w, h: SLIDE.h } }],
  });
  pptx.defineSlideMaster({
    title: "COVER2",
    objects: [{ image: { path: "/cover-bg-2.png", x: 0, y: 0, w: SLIDE.w, h: SLIDE.h } }],
  });
  pptx.defineSlideMaster({
    title: "END1",
    objects: [{ image: { path: "/end-bg-1.png", x: 0, y: 0, w: SLIDE.w, h: SLIDE.h } }],
  });
  pptx.defineSlideMaster({
    title: "END2",
    objects: [{ image: { path: "/end-bg-2.png", x: 0, y: 0, w: SLIDE.w, h: SLIDE.h } }],
  });
  pptx.defineSlideMaster({
    title: "PLAIN",
    background: { color: "FFFFFF" },
  });

  // ====== Cover 1 ======
  {
    const s = pptx.addSlide({ masterName: "COVER1" });
    addText(s, client.projectName || "Project Selection", {
      x: 0.8,
      y: 1.0,
      w: SLIDE.w - 1.6,
      h: 0.8,
      fontSize: 36,
      bold: true,
      color: COLOR_TEXT,
    });
    addText(s, `Prepared for ${client.clientName || "Client"}`, {
      x: 0.8,
      y: 1.8,
      w: SLIDE.w - 1.6,
      h: 0.6,
      fontSize: 16,
      color: COLOR_SUB,
    });
    addText(
      s,
      client.dateISO
        ? new Date(client.dateISO).toLocaleDateString()
        : new Date().toLocaleDateString(),
      { x: 0.8, y: 2.25, w: SLIDE.w - 1.6, h: 0.5, fontSize: 12, color: COLOR_MUTED }
    );
    // contact on cover too (optional)
    if (client.contactName) {
      addText(s, client.contactName, {
        x: 0.8,
        y: 2.75,
        w: SLIDE.w - 1.6,
        h: 0.5,
        fontSize: 14,
        color: COLOR_TEXT,
      });
      const details = [client.contactEmail, client.contactPhone]
        .filter(Boolean)
        .join(" · ");
      addText(s, details, {
        x: 0.8,
        y: 3.15,
        w: SLIDE.w - 1.6,
        h: 0.4,
        fontSize: 12,
        color: COLOR_SUB,
      });
    }
  }

  // ====== Cover 2 (contact emphasis) ======
  {
    const s = pptx.addSlide({ masterName: "COVER2" });
    addText(s, client.projectName || "Project Selection", {
      x: 0.8,
      y: 1.0,
      w: SLIDE.w - 1.6,
      h: 0.7,
      fontSize: 30,
      bold: true,
      color: COLOR_TEXT,
    });
    addText(s, client.contactName || "", {
      x: 0.8,
      y: 1.8,
      w: SLIDE.w - 1.6,
      h: 0.5,
      fontSize: 16,
      color: COLOR_SUB,
    });
    const details2 = [client.contactEmail, client.contactPhone]
      .filter(Boolean)
      .join(" · ");
    if (details2)
      addText(s, details2, {
        x: 0.8,
        y: 2.25,
        w: SLIDE.w - 1.6,
        h: 0.5,
        fontSize: 12,
        color: COLOR_MUTED,
      });
  }

  // ====== Product slides ======
  for (const row of products as any[]) {
    const name = pick(row, ["Name", "Product", "product"]);
    const code = pick(row, ["Code", "SKU", "Product Code", "sku"]);
    const imgUrl = pick(row, ["ImageURL", "Image Url", "Image", "imageurl", "image"]);
    const pdfUrl = pick(row, ["PdfURL", "PDF URL", "Specs PDF", "Spec", "SpecsUrl"]);
    const desc = pick(row, ["Description", "Product Description", "description"]);
    const specsText = pick(row, ["Specs", "Specifications"]);

    const slide = pptx.addSlide({ masterName: "PLAIN" });

    // Title at top (autoshrink)
    addText(slide, name || "Product", {
      ...PRODUCT.title,
      fontSize: titleSize(name || "Product"),
      color: COLOR_TEXT,
      bold: true,
      align: "center",
    });

    // Left image
    if (imgUrl) {
      try {
        const dataUrl = await fetchAsDataUrl(imgUrl);
        slide.addImage({
          data: stripDataPrefix(dataUrl),
          ...PRODUCT.img,
          sizing: { type: "contain", w: PRODUCT.img.w, h: PRODUCT.img.h },
        });
      } catch {
        // ignore
      }
    }

    // Right specs: PDF first page preferred, else bullet text
    let drewSpecs = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1200);
        slide.addImage({
          data: stripDataPrefix(png),
          ...PRODUCT.specs,
          sizing: { type: "contain", w: PRODUCT.specs.w, h: PRODUCT.specs.h },
        });
        drewSpecs = true;
      } catch {
        // fall through to text bullets
      }
    }
    if (!drewSpecs && specsText) {
      const bullets = specsText
        .split(/\r?\n|,|•/g)
        .map((b) => b.trim())
        .filter(Boolean)
        .slice(0, 18); // cap to avoid overflow
      if (bullets.length) {
        addText(slide, bullets.map((b) => `• ${b}`).join("\n"), {
          x: PRODUCT.specs.x,
          y: PRODUCT.specs.y,
          w: PRODUCT.specs.w,
          h: PRODUCT.specs.h,
          fontSize: 12,
          color: COLOR_SUB,
          align: "left",
        });
      }
    }

    // Description (shrink to fit)
    if (desc) {
      addText(slide, desc, {
        ...PRODUCT.desc,
        fontSize: 12,
        color: COLOR_SUB,
        align: "center",
      });
    }

    // Code line
    if (code) {
      addText(slide, code, {
        ...PRODUCT.code,
        fontSize: 11,
        color: COLOR_TEXT,
        align: "center",
      });
    }

    // Footer bar + logo + text (numeric width to satisfy TS)
    slide.addShape(pptx.ShapeType.rect, {
      x: PRODUCT.footerBar.x,
      y: PRODUCT.footerBar.y,
      w: PRODUCT.footerBar.w,
      h: PRODUCT.footerBar.h,
      fill: { color: COLOR_FOOTER },
    });
    slide.addImage({ path: "/logo.png", x: 0.35, y: PRODUCT.footerBar.y + 0.05, w: 1.1, h: 0.35 });
    addText(slide, "Pacific Bathroom · Project Selections", {
      ...PRODUCT.footerText,
      fontSize: 10,
      color: "FFFFFF",
      align: "left",
    });
  }

  // blank end slides
  pptx.addSlide({ masterName: "END1" });
  pptx.addSlide({ masterName: "END2" });

  await pptx.writeFile({
    fileName: `${client.projectName || "Project Selection"}.pptx`,
  });
}