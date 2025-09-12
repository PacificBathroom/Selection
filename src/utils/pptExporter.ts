// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* ===== THEME ===== */
const FONT = "Calibri";
const COLOR_TEXT = "0F172A";
const COLOR_SUB = "334155";
const COLOR_MUTED = "64748B";
const COLOR_FOOTER = "40E0D0"; // turquoise

/* ===== GEOMETRY (16:9 ~ 13.33x7.5in) ===== */
const SLIDE_W = 13.33;

const PRODUCT = {
  img:   { x: 0.5, y: 0.7,  w: 5.8,  h: 3.9 }, // smaller & higher
  specs: { x: 6.6, y: 0.7,  w: 5.9,  h: 3.9 },
  title: { x: 0.7, y: 4.8,  w: 11.9 },
  desc:  { x: 0.7, y: 5.35, w: 11.9 },
  code:  { x: 0.7, y: 5.9,  w: 11.9 },
  footer:{ bar:{ x: 0,  y: 6.95, w: SLIDE_W, h: 0.35 }, text:{ x: 1.5, y: 7.0, w: 11 } }
};

/* ===== HELPERS ===== */
const tx = (s: any, t: string | undefined, o: any) => {
  if (!t) return;
  s.addText(t, { fontFace: FONT, autoFit: true, paraSpaceAfter: 0, ...o });
};

const strip = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

/** Google Drive "view" URL -> direct file URL */
function normalizeUrl(u?: string | null): string | undefined {
  if (!u) return undefined;
  const s = String(u).trim();
  if (!s) return undefined;
  const m = s.match(/https:\/\/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (m?.[1]) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return s;
}

/** Base64 for URLs (browser + node-safe) */
function toB64Url(str: string): string {
  try {
    // eslint-disable-next-line no-undef
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    try {
      return Buffer.from(str, "utf8").toString("base64");
    } catch {
      return str;
    }
  }
}

/** Use Netlify proxy with base64 param */
const viaProxy = (u?: string | null): string | undefined => {
  const norm = normalizeUrl(u);
  if (!norm || !/^https?:\/\//i.test(norm)) return undefined;
  return `/api/pdf-proxy?url_b64=${toB64Url(norm)}`;
};

async function fetchAsDataUrl(u: string): Promise<string> {
  const proxied = viaProxy(u);
  if (!proxied) throw new Error("Bad URL");
  const res = await fetch(proxied, { credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

const autoTitleSize = (name: string) => {
  const len = name?.length || 0;
  if (len <= 28) return 24;
  if (len <= 36) return 22;
  if (len <= 48) return 20;
  if (len <= 60) return 18;
  return 16;
};

function trimDesc(s?: string, max = 280) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

/** Case/space tolerant field picker */
function pick(obj: any, labels: string[], fallback = ""): string {
  for (const k of labels) {
    if (obj?.[k] != null) return String(obj[k]);
    const low = k.toLowerCase();
    const smo = k.replace(/\s+/g, "");
    if (obj?.[low] != null) return String(obj[low]);
    if (obj?.[smo] != null) return String(obj[smo]);
  }
  return fallback;
}

/* ===== EXPORTER ===== */
export async function exportDeckFromProducts({
  client,
  products,
}: { client: ClientInfo; products: Product[] }) {
  const pptx = new PptxGenJS();
  (pptx as any).layout = "LAYOUT_16x9";

  /* Master slides (locked backgrounds) */
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

  /* Cover 1 */
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
    // Contact block
    tx(s, client.contactName || "", { x: 0.8, y: 2.6, w: 11.5, fontSize: 14, color: COLOR_TEXT });
    const details = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    tx(s, details, { x: 0.8, y: 3.0, w: 11.5, fontSize: 12, color: COLOR_SUB });
  }

  /* Cover 2 (contact-focused) */
  {
    const s = pptx.addSlide({ masterName: "COVER2" });
    tx(s, client.projectName || "Project Selection", {
      x: 0.8, y: 1.0, w: 11.5, fontSize: 28, bold: true, color: COLOR_TEXT,
    });
    tx(s, client.contactName || "", { x: 0.8, y: 1.7, w: 11.5, fontSize: 16, color: COLOR_SUB });
    const details2 = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    tx(s, details2, { x: 0.8, y: 2.1, w: 11.5, fontSize: 12, color: COLOR_MUTED });
  }

  /* Product slides */
  for (const raw of products) {
    const productName = pick(raw, ["Name", "Product"], "Product");
    const productCode = pick(raw, ["Code", "SKU", "Product Code"], "");
    const imageUrl    = pick(raw, ["Image", "ImageURL", "Image Url", "imagebox", "image_box", "Thumbnail"], "");
    const pdfUrl      = pick(raw, ["PdfURL", "PDF URL", "Specs PDF", "Spec", "SpecsUrl"], "");
    const description = pick(raw, ["Description", "Product Description"], "");
    const specsStr    = pick(raw, ["Specs", "Specifications"], "");
    const specsBullets = specsStr ? specsStr.split(/\r?\n|,|•/).map(s => s.trim()).filter(Boolean) : undefined;

    const s = pptx.addSlide({ masterName: "PRODUCT" });

    // Image
    if (imageUrl) {
      try {
        const d = await fetchAsDataUrl(imageUrl);
        s.addImage({
          data: strip(d),
          ...PRODUCT.img,
          sizing: { type: "contain", w: PRODUCT.img.w, h: PRODUCT.img.h },
        });
      } catch {}
    }

    // Specs: PDF preview or bullets
    let specsDrawn = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1200);
        s.addImage({
          data: strip(png),
          ...PRODUCT.specs,
          sizing: { type: "contain", w: PRODUCT.specs.w, h: PRODUCT.specs.h },
        });
        specsDrawn = true;
      } catch {}
    }
    if (!specsDrawn && specsBullets?.length) {
      tx(s, specsBullets.map((b) => `• ${b}`).join("\n"), {
        x: PRODUCT.specs.x, y: PRODUCT.specs.y, w: PRODUCT.specs.w, h: PRODUCT.specs.h,
        fontSize: 12, color: COLOR_SUB,
      });
    }

    // Title / description / code
    const title = productName || "Product";
    tx(s, title, {
      ...PRODUCT.title, fontSize: autoTitleSize(title), bold: true, color: COLOR_TEXT, align: "center",
    });

    const desc = trimDesc(description, 280);
    if (desc) tx(s, desc, { ...PRODUCT.desc, fontSize: 12, color: COLOR_SUB, align: "center" });

    if (productCode) tx(s, productCode, { ...PRODUCT.code, fontSize: 11, color: COLOR_TEXT, align: "center" });

    // Footer bar (use string "rect" so it works on all pptxgenjs versions)
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

  /* End slides (background only) */
  pptx.addSlide({ masterName: "END1" });
  pptx.addSlide({ masterName: "END2" });

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}