// src/utils/pptExporter.ts
// @ts-ignore – pptxgenjs ships no types by default in some builds
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo, Product } from "../types";

/* ===== THEME ===== */
const FONT = "Calibri";
const COLOR_TEXT   = "0F172A";
const COLOR_SUB    = "334155";
const COLOR_MUTED  = "64748B";
const COLOR_FOOTER = "40E0D0"; // turquoise footer bar

/* ===== SLIDE GEOMETRY (16:9) =====
   pptxgenjs 16:9 width is ~13.33in, height ~7.5in */
const SLIDE_W = 13.33;

const PRODUCT = {
  img:   { x: 0.5, y: 0.7, w: 5.8, h: 3.9 },
  specs: { x: 6.6, y: 0.7, w: 5.9, h: 3.9 },
  title: { x: 0.7, y: 4.8, w: 11.9 },
  desc:  { x: 0.7, y: 5.35, w: 11.9 },
  code:  { x: 0.7, y: 5.9, w: 11.9 },
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
    autoFit: true,
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

const autoTitleSize = (name?: string) => {
  const len = name?.length || 0;
  if (len <= 28) return 24;
  if (len <= 36) return 22;
  if (len <= 48) return 20;
  if (len <= 60) return 18;
  return 16;
};

/* ===== EXPORTER ===== */
export async function exportDeckFromProducts({
  client,
  products,
}: { client: ClientInfo; products: Product[] }) {
  const pptx = new PptxGenJS();
  // Force 16:9
  (pptx as any).layout = "LAYOUT_16x9";

  // Locked background masters (image w/h can use "100%")
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

  /* --- Cover slide 1 --- */
  {
    const s = pptx.addSlide({ masterName: "COVER1" });
    tx(s, client.projectName || "Project Selection", {
      x: 0.8, y: 1.0, w: 11.5, fontSize: 34, bold: true, color: COLOR_TEXT,
    });
    tx(s, `Prepared for ${client.clientName || "Client"}`, {
      x: 0.8, y: 1.7, w: 11.5, fontSize: 16, color: COLOR_SUB,
    });
    tx(s,
      client.dateISO ? new Date(client.dateISO).toLocaleDateString()
                     : new Date().toLocaleDateString(),
      { x: 0.8, y: 2.1, w: 11.5, fontSize: 12, color: COLOR_MUTED }
    );
    // Contact lines
    tx(s, client.contactName || "", { x: 0.8, y: 2.6, w: 11.5, fontSize: 14, color: COLOR_TEXT });
    const details = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    tx(s, details, { x: 0.8, y: 3.0, w: 11.5, fontSize: 12, color: COLOR_SUB });
  }

  /* --- Cover slide 2 (contact emphasis) --- */
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
    // Be liberal with header names to match the sheet
    const get = (obj: any, keys: string[], fallback = "") =>
      String(keys.map(k => obj?.[k] ?? obj?.[k.toLowerCase()] ?? obj?.[k.replace(/\s+/g, "")])
                 .find(v => v != null) ?? fallback);

    const productName = get(raw, ["Name", "Product"]);
    const productCode = get(raw, ["Code", "SKU", "Product Code"]);
    const imageUrl    = get(raw, ["ImageURL","Image Url","Image","image","Thumbnail","imagebox","image_box"]);
    const pdfUrl      = get(raw, ["PdfURL","PDF URL","Specs PDF","Spec","SpecsUrl"]);
    const description = get(raw, ["Description","Product Description"]);

    const specsStr = get(raw, ["Specs","Specifications"], "");
    const specsBullets = specsStr
      ? specsStr.split(/\r?\n|,|•/).map(s => s.trim()).filter(Boolean)
      : undefined;

    const s = pptx.addSlide({ masterName: "PRODUCT" });

    // Left: product image (via proxy)
    if (imageUrl) {
      try {
        const d = await fetchAsDataUrl(imageUrl);
        s.addImage({
          data: strip(d),
          ...PRODUCT.img,
          sizing: { type: "contain", w: PRODUCT.img.w, h: PRODUCT.img.h },
        });
      } catch {/* ignore */}
    }

    // Right: spec PDF first page (fallback to bullets)
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
      } catch {/* ignore and fall back */}
    }
    if (!drewSpecs && specsBullets?.length) {
      tx(s, specsBullets.map(b => `• ${b}`).join("\n"), {
        x: PRODUCT.specs.x, y: PRODUCT.specs.y, w: PRODUCT.specs.w, h: PRODUCT.specs.h,
        fontSize: 12, color: COLOR_SUB,
      });
    }

    // Centered title / desc / code (autoshrink prevents overflow)
    tx(s, productName || "Product", {
      ...PRODUCT.title,
      fontSize: autoTitleSize(productName || "Product"),
      bold: true,
      color: COLOR_TEXT,
      align: "center",
    });
    tx(s, description || "", {
      ...PRODUCT.desc,
      fontSize: 12,
      color: COLOR_SUB,
      align: "center",
    });
    tx(s, productCode || "", {
      ...PRODUCT.code,
      fontSize: 11,
      color: COLOR_TEXT,
      align: "center",
    });

    // Footer bar (use string type for shape + numeric w)
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