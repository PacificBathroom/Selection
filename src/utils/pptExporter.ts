// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import type { ClientInfo, Product } from "../types";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";

/* ====== slide metrics (16:9) ====== */
const SLIDE_W = 13.33;
const SLIDE_H = 7.5;

/* ====== styles ====== */
const FONT = "Calibri";
const COLOR_TEXT = "0F172A";
const COLOR_SUB = "334155";
const COLOR_MUTED = "64748B";
const COLOR_FOOTER = "40E0D0";

/* ====== geometry ====== */
const L = {
  title: { x: 0.7, y: 0.55, w: SLIDE_W - 1.4, h: 0.6 },
  img:   { x: 0.6, y: 1.4,  w: 5.8, h: 3.9 },
  specs: { x: 6.9, y: 1.4,  w: 5.8, h: 3.9 },
  desc:  { x: 0.7, y: 5.5,  w: SLIDE_W - 1.4, h: 0.8 },
  code:  { x: 0.7, y: 6.3,  w: SLIDE_W - 1.4, h: 0.4 },
  footerBar:  { x: 0,    y: 7.0,  w: SLIDE_W, h: 0.3 },
  footerText: { x: 1.5,  y: 7.03, w: SLIDE_W - 1.8, h: 0.3 },
  footerLogo: { x: 0.3,  y: 7.02, w: 1.0, h: 0.3 },
};

const tx = (s: any, text?: string, opts?: any) => {
  if (!text) return;
  s.addText(text, {
    fontFace: FONT,
    color: COLOR_TEXT,
    paraSpaceAfter: 0,
    autoFit: true,
    ...opts,
  });
};

const stripDataUrl = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

/* ----- proxy helpers ----- */
const viaProxy = (u?: string | null) => {
  const s = (u ?? "").toString().trim();
  if (!/^https?:\/\//i.test(s)) return undefined;
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
    fr.onload = () => resolve(String(fr.result) || "");
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

const autoTitleSize = (t?: string) => {
  const len = t?.length || 0;
  if (len <= 28) return 24;
  if (len <= 36) return 22;
  if (len <= 48) return 20;
  if (len <= 60) return 18;
  return 16;
};

function first<T = string>(obj: any, keys: string[]): T | "" {
  for (const k of keys) {
    const v =
      obj?.[k] ??
      obj?.[k?.toLowerCase?.()] ??
      obj?.[k?.replace?.(/\s+/g, "")] ??
      obj?.[k?.replace?.(/_/g, "")];
    if (v != null && String(v).trim() !== "") return v as T;
  }
  return "" as unknown as T;
}

/* ====== main exporter ====== */
export async function exportDeckFromProducts({
  client,
  products,
}: {
  client: ClientInfo;
  products: Product[];
}) {
  const pptx = new PptxGenJS();
  (pptx as any).layout = "LAYOUT_16x9";

  /* ---- define masters for branded covers/ends ---- */
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

  /* ---- COVER 1: title + prepared for ---- */
  {
    const s = pptx.addSlide({ masterName: "COVER1" });
    tx(s, client.projectName || "Project Selection", {
      x: 0.8,
      y: 1.0,
      w: SLIDE_W - 1.6,
      h: 0.9,
      fontSize: 34,
      bold: true,
    });
    tx(s, `Prepared for ${client.clientName || "Client name"}`, {
      x: 0.8,
      y: 1.9,
      w: SLIDE_W - 1.6,
      h: 0.4,
      fontSize: 16,
      color: COLOR_SUB,
    });
    tx(
      s,
      client.dateISO
        ? new Date(client.dateISO).toLocaleDateString()
        : new Date().toLocaleDateString(),
      { x: 0.8, y: 2.3, w: SLIDE_W - 1.6, h: 0.3, fontSize: 12, color: COLOR_MUTED }
    );
  }

  /* ---- COVER 2: contact block ---- */
  {
    const s = pptx.addSlide({ masterName: "COVER2" });
    tx(s, client.projectName || "Project Selection", {
      x: 0.8,
      y: 1.0,
      w: SLIDE_W - 1.6,
      h: 0.8,
      fontSize: 28,
      // ❌ border: true
border: { style: "solid", color: "000000", pt: 1 }  // or just remove border entirely
,
    });
    tx(s, client.contactName || "", {
      x: 0.8,
      y: 1.7,
      w: SLIDE_W - 1.6,
      h: 0.4,
      fontSize: 16,
      color: COLOR_SUB,
    });
    const contactLine = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    tx(s, contactLine, {
      x: 0.8,
      y: 2.1,
      w: SLIDE_W - 1.6,
      h: 0.4,
      fontSize: 12,
      color: COLOR_MUTED,
    });
  }

  /* ---- PRODUCT SLIDES ---- */
  for (const raw of products) {
    const title =
      first<string>(raw, ["name", "Name", "product", "Product"]) || "Product";

    const imageUrl =
      first<string>(raw, ["imageurl", "imageUrl", "image", "thumbnail"]) || "";

    const pdfUrl =
      first<string>(raw, ["pdfurl", "PdfURL", "specPdfUrl", "specpdfurl"]) || "";

    const description =
      first<string>(raw, ["description", "Description"]) || "";

    const code = first<string>(raw, ["code", "Code", "sku", "SKU"]) || "";

    const specsText =
      (Array.isArray(raw.specs)
        ? raw.specs.map((x: any) => `${x?.label ?? ""} ${x?.value ?? ""}`.trim())
        : (raw.specs as unknown as string)) ||
      (raw.specifications as unknown as string) ||
      "";

    const s = pptx.addSlide();

    // title
    tx(s, title, {
      ...L.title,
      align: "center",
      bold: true,
      fontSize: autoTitleSize(title),
    });

    // image (or placeholder)
    let drewImage = false;
    if (imageUrl) {
      try {
        const data = await fetchAsDataUrl(imageUrl);
        s.addImage({
          data: stripDataUrl(data),
          ...L.img,
          sizing: { type: "contain", w: L.img.w, h: L.img.h },
        });
        drewImage = true;
      } catch {}
    }
    if (!drewImage) {
      s.addShape(pptx.ShapeType.rect, {
        x: L.img.x,
        y: L.img.y,
        w: L.img.w,
        h: L.img.h,
        fill: { color: "F1F5F9" },
        line: { color: "CBD5E1" },
      });
    }

    // specs (PDF > text > placeholder)
    let drewSpecs = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1400);
        s.addImage({
          data: stripDataUrl(png),
          ...L.specs,
          sizing: { type: "contain", w: L.specs.w, h: L.specs.h },
        });
        drewSpecs = true;
      } catch {}
    }
    if (!drewSpecs && specsText) {
      const bullets = String(specsText)
        .split(/\r?\n|•|,|;|\u2022/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => `• ${t}`)
        .join("\n");
      tx(s, bullets, {
        x: L.specs.x,
        y: L.specs.y,
        w: L.specs.w,
        h: L.specs.h,
        fontSize: 12,
        color: COLOR_SUB,
      });
      drewSpecs = true;
    }
    if (!drewSpecs) {
      s.addShape(pptx.ShapeType.rect, {
        x: L.specs.x,
        y: L.specs.y,
        w: L.specs.w,
        h: L.specs.h,
        fill: { color: "F1F5F9" },
        line: { color: "CBD5E1" },
      });
    }

    // description + code
    if (description) {
      tx(s, description, {
        ...L.desc,
        align: "center",
        fontSize: 12,
        color: COLOR_SUB,
      });
    }
    if (code) {
      tx(s, code, {
        ...L.code,
        align: "center",
        fontSize: 11,
      });
    }

    // footer
    s.addShape(pptx.ShapeType.rect, {
      x: L.footerBar.x,
      y: L.footerBar.y,
      w: L.footerBar.w,
      h: L.footerBar.h,
      fill: { color: COLOR_FOOTER },
      line: { color: COLOR_FOOTER },
    });
    s.addImage({
      path: "/logo.png",
      x: L.footerLogo.x,
      y: L.footerLogo.y,
      w: L.footerLogo.w,
      h: L.footerLogo.h,
    });
    tx(s, "Pacific Bathroom · Project Selections", {
      x: L.footerText.x,
      y: L.footerText.y,
      w: L.footerText.w,
      h: L.footerText.h,
      align: "left",
      color: "FFFFFF",
      fontSize: 10,
    });
  }

  /* ---- END SLIDES ---- */
  pptx.addSlide({ masterName: "END1" });
  pptx.addSlide({ masterName: "END2" });

  await pptx.writeFile({
    fileName: `${client.projectName || "Project Selection"}.pptx`,
  });
}
