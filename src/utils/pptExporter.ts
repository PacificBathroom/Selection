// src/utils/pptExporter.ts
// @ts-ignore - pptxgenjs ships no types in some builds
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* ===== VISUALS ===== */
const FONT = "Calibri";
const COLOR_TEXT = "0F172A";
const COLOR_SUB = "334155";
const COLOR_MUTED = "64748B";
const COLOR_FOOTER = "40E0D0"; // turquoise

/* ===== SLIDE GEOMETRY (16:9 ~ 13.33 x 7.5 in) ===== */
const SLIDE_W = 13.33;
const SLIDE_H = 7.5;

const L = 0.6;                // standard left gutter
const R = SLIDE_W - 0.6;      // right edge reference

const PRODUCT = {
  // Title at top, centered
  title: { x: L, y: 0.35, w: SLIDE_W - L * 2, h: 0.7 },

  // Two columns (image left, specs right)
  img:   { x: L,        y: 1.15, w: 6.0, h: 3.9 },
  specs: { x: L + 6.3,  y: 1.15, w: 6.0, h: 3.9 },

  // Description under the columns
  desc:  { x: L, y: 5.2, w: SLIDE_W - L * 2, h: 0.9 },

  // Code above the footer
  code:  { x: L, y: 6.1, w: SLIDE_W - L * 2, h: 0.5 },

  // Footer
  footerBar: { x: 0, y: 6.9, w: SLIDE_W, h: 0.35 },
  footerTxt: { x: 1.5, y: 6.98, w: SLIDE_W - 2.0, h: 0.4 },
};

const stripDataPrefix = (s: string) => s.replace(/^data:[^;]+;base64,/, "");

/** Robust field getter that tolerates different header spellings/cases */
function getField(obj: any, names: string[], fallback = ""): string {
  for (const n of names) {
    const v =
      obj?.[n] ??
      obj?.[n.toLowerCase()] ??
      obj?.[n.replace(/\s+/g, "")] ??
      obj?.[n.replace(/[_\s]+/g, "")];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return fallback;
}

/** Proxy any external URL via our Netlify function (avoids CORS headaches) */
function viaProxy(u?: string | null) {
  const s = (u ?? "").toString().trim();
  if (!s || !/^https?:\/\//i.test(s)) return undefined;
  return `/api/pdf-proxy?url=${encodeURIComponent(s)}`;
}

/** Fetch any image/PDF URL and return a data: URL string */
async function fetchAsDataUrl(rawUrl: string): Promise<string> {
  const url = viaProxy(rawUrl);
  if (!url) throw new Error("Bad URL");
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

/** Auto-size title a bit for long names */
function titleSize(name: string) {
  const n = (name || "").length;
  if (n <= 28) return 28;
  if (n <= 36) return 26;
  if (n <= 48) return 24;
  if (n <= 60) return 22;
  return 20;
}

/** Add text with consistent defaults and autoshrink */
function addText(s: any, text: string, box: any, opts: any = {}) {
  if (!text) return;
  s.addText(text, {
    fontFace: FONT,
    color: COLOR_TEXT,
    autoFit: true,         // shrink to fit box
    valign: "top",
    margin: 4,
    paraSpaceAfter: 0,
    ...box,
    ...opts,
  });
}

/* ===== MAIN EXPORT ===== */
export async function exportDeckFromProducts({
  client,
  products,
}: {
  client: ClientInfo;
  products: Product[];
}) {
  const pptx = new PptxGenJS();
  // Force 16:9 layout
  (pptx as any).layout = "LAYOUT_16x9";

  // Master slides with numeric w/h (avoids TS type errors)
  pptx.defineSlideMaster({
    title: "COVER1",
    objects: [{ image: { path: "/cover-bg-1.png", x: 0, y: 0, w: SLIDE_W, h: SLIDE_H } }],
  });
  pptx.defineSlideMaster({
    title: "COVER2",
    objects: [{ image: { path: "/cover-bg-2.png", x: 0, y: 0, w: SLIDE_W, h: SLIDE_H } }],
  });
  pptx.defineSlideMaster({
    title: "END1",
    objects: [{ image: { path: "/end-bg-1.png", x: 0, y: 0, w: SLIDE_W, h: SLIDE_H } }],
  });
  pptx.defineSlideMaster({
    title: "END2",
    objects: [{ image: { path: "/end-bg-2.png", x: 0, y: 0, w: SLIDE_W, h: SLIDE_H } }],
  });
  pptx.defineSlideMaster({
    title: "PRODUCT",
    background: { color: "FFFFFF" },
    objects: [],
  });

  /* ---- COVER 1 ---- */
  {
    const s = pptx.addSlide({ masterName: "COVER1" });
    addText(s, client.projectName || "Project Selection", PRODUCT.title, {
      y: 1.0,
      fontSize: 34,
      bold: true,
      align: "left",
    });
    addText(s, `Prepared for ${client.clientName || "Client"}`, { x: L, y: 1.75, w: SLIDE_W - L * 2, h: 0.5 }, {
      fontSize: 16,
      color: COLOR_SUB,
    });
    addText(
      s,
      client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString(),
      { x: L, y: 2.15, w: SLIDE_W - L * 2, h: 0.4 },
      { fontSize: 12, color: COLOR_MUTED }
    );
    // Optional contact
    if (client.contactName) addText(s, client.contactName, { x: L, y: 2.6, w: SLIDE_W - L * 2, h: 0.4 }, { fontSize: 14 });
    const details = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    if (details)
      addText(s, details, { x: L, y: 3.0, w: SLIDE_W - L * 2, h: 0.4 }, { fontSize: 12, color: COLOR_SUB });
  }

  /* ---- COVER 2 (contact emphasis) ---- */
  {
    const s = pptx.addSlide({ masterName: "COVER2" });
    addText(s, client.projectName || "Project Selection", { x: L, y: 1.0, w: SLIDE_W - L * 2, h: 0.7 }, {
      fontSize: 28,
      bold: true,
      align: "left",
    });
    if (client.contactName)
      addText(s, client.contactName, { x: L, y: 1.7, w: SLIDE_W - L * 2, h: 0.5 }, { fontSize: 16, color: COLOR_SUB });
    const details2 = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    if (details2)
      addText(s, details2, { x: L, y: 2.1, w: SLIDE_W - L * 2, h: 0.4 }, { fontSize: 12, color: COLOR_MUTED });
  }

  /* ---- PRODUCT SLIDES ---- */
  for (const row of products as any[]) {
    const name  = getField(row, ["Name", "Product"]);
    const code  = getField(row, ["Code", "SKU", "Product Code"]);
    const img   = getField(row, ["ImageURL", "Image Url", "Image", "imagebox", "image_box", "Thumbnail"]);
    const pdf   = getField(row, ["PdfURL", "PDF URL", "Specs PDF", "Spec", "SpecsUrl"]);
    const desc  = getField(row, ["Description", "Product Description"]);
    const specsStr = getField(row, ["SpecsBullets", "Specs", "Specifications"], "");
    const specsBullets =
      specsStr ? specsStr.split(/\r?\n|,|•/).map((s) => s.trim()).filter(Boolean) : undefined;

    const s = pptx.addSlide({ masterName: "PRODUCT" });

    // Title at top
    addText(s, name || "Product", PRODUCT.title, {
      fontSize: titleSize(name || "Product"),
      bold: true,
      align: "center",
    });

    // Left image (through proxy)
    if (img) {
      try {
        const dataUrl = await fetchAsDataUrl(img);
        s.addImage({
          data: stripDataPrefix(dataUrl),
          x: PRODUCT.img.x,
          y: PRODUCT.img.y,
          w: PRODUCT.img.w,
          h: PRODUCT.img.h,
          sizing: { type: "contain", w: PRODUCT.img.w, h: PRODUCT.img.h },
        });
      } catch {
        // ignore; keep blank tile
      }
    }

    // Right specs: PDF first page → bullets
    let drewSpecs = false;
    if (pdf) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdf)!, 1200);
        s.addImage({
          data: stripDataPrefix(png),
          x: PRODUCT.specs.x,
          y: PRODUCT.specs.y,
          w: PRODUCT.specs.w,
          h: PRODUCT.specs.h,
          sizing: { type: "contain", w: PRODUCT.specs.w, h: PRODUCT.specs.h },
        });
        drewSpecs = true;
      } catch {
        // fall back to bullets below
      }
    }
    if (!drewSpecs && specsBullets?.length) {
      addText(
        s,
        specsBullets.map((b) => `• ${b}`).join("\n"),
        PRODUCT.specs,
        { fontSize: 12, color: COLOR_SUB }
      );
    }

    // Description (auto-fit)
    if (desc) {
      addText(s, desc, PRODUCT.desc, { fontSize: 12, color: COLOR_SUB, align: "center" });
    }

    // Code
    if (code) {
      addText(s, code, PRODUCT.code, { fontSize: 11, align: "center" });
    }

    // Footer bar + text (some pptxgenjs builds need string shape type)
    s.addShape("rect", {
      x: PRODUCT.footerBar.x,
      y: PRODUCT.footerBar.y,
      w: PRODUCT.footerBar.w,
      h: PRODUCT.footerBar.h,
      fill: { color: COLOR_FOOTER },
      line: { color: COLOR_FOOTER },
    });
    // Optional logo in footer
    try {
      s.addImage({ path: "/logo.png", x: 0.3, y: 6.98, w: 1.0, h: 0.3 });
    } catch {}
    addText(
      s,
      "Pacific Bathroom · Project Selections",
      PRODUCT.footerTxt,
      { fontSize: 10, color: "FFFFFF", align: "left" }
    );
  }

  // Two blank end slides (branding pages)
  pptx.addSlide({ masterName: "END1" });
  pptx.addSlide({ masterName: "END2" });

  await pptx.writeFile({
    fileName: `${client.projectName || "Project Selection"}.pptx`,
  });
}