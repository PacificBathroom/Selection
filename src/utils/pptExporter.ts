// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* ===== THEME ===== */
const FONT = "Calibri";
const COLOR_TEXT   = "0F172A";
const COLOR_SUB    = "334155";
const COLOR_MUTED  = "64748B";
const COLOR_FOOTER = "40E0D0"; // turquoise footer bar
const COLOR_PLACEHOLDER_BORDER = "CBD5E1";
const COLOR_PLACEHOLDER_TEXT   = "94A3B8";

/* ===== SLIDE GEOMETRY (16:9) ===== */
const SLIDE_W = 13.33;   // ~13.33in for 16:9
const SLIDE_H = 7.5;

const PRODUCT = {
  title: { x: 0.6, y: 0.35, w: SLIDE_W - 1.2 }, // top
  img:   { x: 0.5, y: 1.1, w: 5.8, h: 3.9 },    // left column
  specs: { x: 6.6, y: 1.1, w: 5.9, h: 3.9 },    // right column
  desc:  { x: 0.7, y: 5.25, w: 11.9 },
  code:  { x: 0.7, y: 5.9,  w: 11.9 },
  footer: {
    bar:  { x: 0, y: 6.95, w: SLIDE_W, h: 0.35 },
    text: { x: 1.5, y: 7.0,  w: 11.0 }
  }
};

/* ===== helpers ===== */
const tx = (s: any, t: string | undefined, o: any) => {
  if (!t) return;
  s.addText(t, {
    fontFace: FONT,
    autoFit: true,            // keep text inside
    paraSpaceAfter: 0,
    ...o,
  });
};
const strip = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

const viaProxy = (u?: string | null) => {
  const s = (u ?? "").toString().trim();
  if (!s || !/^https?:\/\//i.test(s)) return undefined;
  return `/api/pdf-proxy?url=${encodeURIComponent(s)}`;
};

async function asDataUrlWithFallback(url?: string): Promise<string | null> {
  if (!url) return null;
  const tryFetch = async (u: string) => {
    const res = await fetch(u, { credentials: "omit" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  };

  // 1) proxy
  try {
    const p = viaProxy(url);
    if (p) return await tryFetch(p);
  } catch {}

  // 2) direct
  try {
    return await tryFetch(url);
  } catch {}

  return null;
}

const autoTitleSize = (name?: string) => {
  const len = name?.length || 0;
  if (len <= 28) return 28;
  if (len <= 36) return 26;
  if (len <= 48) return 24;
  if (len <= 60) return 22;
  return 20; // very long
};

/* ===== EXPORTER ===== */
export async function exportDeckFromProducts({
  client,
  products,
}: { client: ClientInfo; products: Product[] }) {
  const pptx = new PptxGenJS();
  (pptx as any).layout = "LAYOUT_16x9";

  // Masters
  pptx.defineSlideMaster({
    title: "COVER1",
    objects: [{ image: { path: "/cover-bg-1.png", x: 0, y: 0, w: "100%", h: "100%" } }],
  });
  pptx.defineSlideMaster({
    title: "COVER2",
    objects: [{ image: { path: "/cover-bg-2.png", x: 0, y: 0, w: "100%", h: "100%" } }],
  });
  pptx.defineSlideMaster({
    title: "END1",
    objects: [{ image: { path: "/end-bg-1.png", x: 0, y: 0, w: "100%", h: "100%" } }],
  });
  pptx.defineSlideMaster({
    title: "END2",
    objects: [{ image: { path: "/end-bg-2.png", x: 0, y: 0, w: "100%", h: "100%" } }],
  });
  pptx.defineSlideMaster({
    title: "PRODUCT",
    background: { color: "FFFFFF" },
    objects: [],
  });

  /* --- Cover 1 --- */
  {
    const s = pptx.addSlide({ masterName: "COVER1" });
    tx(s, client.projectName || "Project Selection", {
      x: 0.8, y: 1.0, w: 11.5, fontSize: 34, bold: true, color: COLOR_TEXT,
    });
    tx(s, `Prepared for ${client.clientName || "Client"}`, {
      x: 0.8, y: 1.7, w: 11.5, fontSize: 16, color: COLOR_SUB,
    });
    tx(
      s,
      client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString(),
      { x: 0.8, y: 2.1, w: 11.5, fontSize: 12, color: COLOR_MUTED }
    );
    // Contact lines
    tx(s, client.contactName || "", { x: 0.8, y: 2.6, w: 11.5, fontSize: 14, color: COLOR_TEXT });
    const details = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    tx(s, details, { x: 0.8, y: 3.0, w: 11.5, fontSize: 12, color: COLOR_SUB });
  }

  /* --- Cover 2 (contact emphasis) --- */
  {
    const s = pptx.addSlide({ masterName: "COVER2" });
    tx(s, client.projectName || "Project Selection", {
      x: 0.8, y: 1.0, w: 11.5, fontSize: 28, bold: true, color: COLOR_TEXT,
    });
    tx(s, client.contactName || "", { x: 0.8, y: 1.7, w: 11.5, fontSize: 16, color: COLOR_SUB });
    const details2 = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    tx(s, details2, { x: 0.8, y: 2.1, w: 11.5, fontSize: 12, color: COLOR_MUTED });
  }

  /* --- Product slides --- */
  for (const raw of products) {
    const get = (obj: any, keys: string[], fallback = "") =>
      String(keys.map(k => obj?.[k] ?? obj?.[k.toLowerCase()] ?? obj?.[k.replace(/\s+/g, "")])
                 .find(v => v != null) ?? fallback);

    const productName = get(raw, ["Name","Product"]);
    const productCode = get(raw, ["Code","SKU","Product Code"]);
    const imageUrl    = get(raw, ["ImageURL","Image Url","Image","image","Thumbnail","imagebox","image_box"]);
    const pdfUrl      = get(raw, ["PdfURL","PDF URL","Specs PDF","Spec","SpecsUrl"]);
    const description = get(raw, ["Description","Product Description"]);
    const specsStr    = get(raw, ["Specs","Specifications"], "");
    const specsBullets = specsStr ? specsStr.split(/\r?\n|,|•/).map(s => s.trim()).filter(Boolean) : undefined;

    const s = pptx.addSlide({ masterName: "PRODUCT" });

    // Title at the top
    tx(s, productName || "Product", {
      ...PRODUCT.title,
      fontSize: autoTitleSize(productName || "Product"),
      bold: true,
      color: COLOR_TEXT,
      align: "center",
    });

    // Left: image (robust fetching)
    let drewImage = false;
    if (imageUrl) {
      const dataUrl = await asDataUrlWithFallback(imageUrl);
      if (dataUrl) {
        s.addImage({
          data: strip(dataUrl),
          ...PRODUCT.img,
          sizing: { type: "contain", w: PRODUCT.img.w, h: PRODUCT.img.h },
        });
        drewImage = true;
      }
    }
    if (!drewImage) {
      // subtle placeholder with the URL so you can confirm what was attempted
      s.addShape("rect", {
        ...PRODUCT.img,
        line: { color: COLOR_PLACEHOLDER_BORDER, width: 1 },
        fill: { color: "FFFFFF" },
      });
      tx(s, imageUrl ? imageUrl : "No image URL", {
        x: PRODUCT.img.x + 0.2,
        y: PRODUCT.img.y + PRODUCT.img.h / 2 - 0.2,
        w: PRODUCT.img.w - 0.4,
        fontSize: 10,
        color: COLOR_PLACEHOLDER_TEXT,
        align: "center",
      });
    }

    // Right: specs (PDF first page or bullets)
    let drewSpecs = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1200);
        s.addImage({
          data: strip(png),
          ...PRODUCT.specs,
          sizing: { type: "contain", w: PRODUCT.specs.w, h: PRODUCT.specs.h },
        });
        drewSpecs = true;
      } catch {
        // fall back below
      }
    }
    if (!drewSpecs && specsBullets?.length) {
      tx(s, specsBullets.map((b) => `• ${b}`).join("\n"), {
        x: PRODUCT.specs.x, y: PRODUCT.specs.y, w: PRODUCT.specs.w, h: PRODUCT.specs.h,
        fontSize: 12, color: COLOR_SUB,
      });
    }
    if (!drewSpecs && !specsBullets?.length) {
      s.addShape("rect", {
        ...PRODUCT.specs,
        line: { color: COLOR_PLACEHOLDER_BORDER, width: 1 },
        fill: { color: "FFFFFF" },
      });
      tx(s, pdfUrl ? pdfUrl : "No specs", {
        x: PRODUCT.specs.x + 0.2,
        y: PRODUCT.specs.y + PRODUCT.specs.h / 2 - 0.2,
        w: PRODUCT.specs.w - 0.4,
        fontSize: 10,
        color: COLOR_PLACEHOLDER_TEXT,
        align: "center",
      });
    }

    // Description / Code (centered, autoshrink)
    tx(s, description || "", {
      ...PRODUCT.desc, fontSize: 12, color: COLOR_SUB, align: "center",
    });
    tx(s, productCode || "", {
      ...PRODUCT.code, fontSize: 11, color: COLOR_TEXT, align: "center",
    });

    // Footer bar + logo
    s.addShape("rect", {
      ...PRODUCT.footer.bar,
      fill: { color: COLOR_FOOTER },
    });
    s.addImage({ path: "/logo.png", x: 0.3, y: 7.0, w: 1.0, h: 0.3 });
    tx(s, "Pacific Bathroom · Project Selections", {
      x: PRODUCT.footer.text.x, y: PRODUCT.footer.text.y, w: PRODUCT.footer.text.w,
      fontSize: 10, color: "FFFFFF", align: "left",
    });
  }

  // Two blank end slides
  pptx.addSlide({ masterName: "END1" });
  pptx.addSlide({ masterName: "END2" });

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}