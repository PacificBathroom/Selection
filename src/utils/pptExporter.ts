// src/utils/pptExporter.ts
// @ts-ignore
import PptxGenJS from "pptxgenjs";
import { renderPdfFirstPageToDataUrl } from "../utils/pdfPreview";
import type { ClientInfo } from "../types";

/* -------------------- CONFIG -------------------- */
const DEBUG_LOG_ROWS = false;               // flip to true to log row keys once
const FONT          = "Calibri";
const COLOR_TEXT    = "0F172A";
const COLOR_SUB     = "334155";
const COLOR_MUTED   = "64748B";
const COLOR_FOOTER  = "40E0D0";            // turquoise footer bar

// 16:9 geometry (a bit higher + smaller so nothing overflows)
const PRODUCT = {
  img:   { x: 0.5, y: 0.60, w: 5.8, h: 3.9 },
  specs: { x: 6.6, y: 0.60, w: 5.9, h: 3.9 },
  title: { x: 0.7, y: 4.55, w: 11.9 },
  desc:  { x: 0.7, y: 5.05, w: 11.9 },
  code:  { x: 0.7, y: 5.65, w: 11.9 },
  footer:{ bar:{ x:0, y:6.95, w:"100%", h:0.35 }, text:{ x:1.5, y:7.0, w:11 } }
};

/* -------------------- HELPERS -------------------- */
const tx = (s: any, t?: string, o?: any) => {
  if (!t) return;
  s.addText(t, {
    fontFace: FONT,
    autoFit: true,      // keep text inside the box
    paraSpaceAfter: 0,  // avoid extra spacing pushing things down
    ...o,
  });
};

const stripDataPrefix = (d: string) => d.replace(/^data:[^;]+;base64,/, "");

function normalizeUrl(u?: string | null): string | undefined {
  if (!u) return;
  const s = String(u).trim();
  if (!s) return;

  // Drive viewer -> direct download
  const m1 = s.match(/https:\/\/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (m1?.[1]) return `https://drive.google.com/uc?export=download&id=${m1[1]}`;

  const m2 = s.match(/https:\/\/drive\.google\.com\/open\?id=([^&]+)/i);
  if (m2?.[1]) return `https://drive.google.com/uc?export=download&id=${m2[1]}`;

  const m3 = s.match(/https:\/\/lh3\.googleusercontent\.com\/d\/([^/?#]+)/i);
  if (m3?.[1]) return `https://lh3.googleusercontent.com/d/${m3[1]}`;

  // Dropbox ?dl=0 -> 1
  if (/^https:\/\/www\.dropbox\.com\//i.test(s)) {
    const url = new URL(s);
    url.searchParams.set("dl", "1");
    return url.toString();
  }

  return s;
}

const toB64 = (str: string) => {
  try {
    // @ts-ignore
    return (typeof Buffer !== "undefined"
      ? Buffer.from(str, "utf8").toString("base64")
      : btoa(str));
  } catch { return str; }
};

// Use url_b64 so tricky querystrings never break
const viaProxy = (u?: string | null) => {
  const norm = normalizeUrl(u);
  if (!norm || !/^https?:\/\//i.test(norm)) return undefined;
  return `/api/pdf-proxy?url_b64=${toB64(norm)}`;
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
const trimDesc = (s?: string, max = 220) =>
  !s ? "" : s.replace(/\s+/g, " ").trim().slice(0, max) + (s.length > max ? "…" : "");

// Read value by any of these header aliases
const val = (row: any, keys: string[], fb = ""): string =>
  String(
    keys
      .map(k => row?.[k] ?? row?.[k.toLowerCase()] ?? row?.[k.replace(/\s+/g, "")])
      .find(v => v != null) ?? fb
  );

/* -------------------- EXPORTER -------------------- */
export async function exportDeckFromProducts({
  client,
  products, // pass raw sheet rows here!
}: { client: ClientInfo; products: any[] }) {
  const pptx = new PptxGenJS();
  (pptx as any).layout = "LAYOUT_16x9";

  // Masters (locked backgrounds)
  pptx.defineSlideMaster({ title: "COVER1",  objects: [{ image: { path: "/cover-bg-1.png", x:0, y:0, w:"100%", h:"100%" } }] });
  pptx.defineSlideMaster({ title: "COVER2",  objects: [{ image: { path: "/cover-bg-2.png", x:0, y:0, w:"100%", h:"100%" } }] });
  pptx.defineSlideMaster({ title: "END1",    objects: [{ image: { path: "/end-bg-1.png", x:0, y:0, w:"100%", h:"100%" } }] });
  pptx.defineSlideMaster({ title: "END2",    objects: [{ image: { path: "/end-bg-2.png", x:0, y:0, w:"100%", h:"100%" } }] });
  pptx.defineSlideMaster({ title: "PRODUCT", background: { color: "FFFFFF" }, objects: [] });

  // COVER 1
  {
    const s = pptx.addSlide({ masterName: "COVER1" });
    tx(s, client.projectName || "Project Selection", { x:0.8, y:1.0, w:11.5, fontSize:34, bold:true, color:COLOR_TEXT });
    tx(s, `Prepared for ${client.clientName || "Client"}`, { x:0.8, y:1.7, w:11.5, fontSize:16, color:COLOR_SUB });
    tx(s, client.dateISO ? new Date(client.dateISO).toLocaleDateString() : new Date().toLocaleDateString(),
      { x:0.8, y:2.1, w:11.5, fontSize:12, color:COLOR_MUTED });
    tx(s, client.contactName || "", { x:0.8, y:2.6, w:11.5, fontSize:14, color:COLOR_TEXT });
    const details = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    tx(s, details, { x:0.8, y:3.0, w:11.5, fontSize:12, color:COLOR_SUB });
  }

  // COVER 2 (contact-focused)
  {
    const s = pptx.addSlide({ masterName: "COVER2" });
    tx(s, client.projectName || "Project Selection", { x:0.8, y:1.0, w:11.5, fontSize:28, bold:true, color:COLOR_TEXT });
    tx(s, client.contactName || "", { x:0.8, y:1.7, w:11.5, fontSize:16, color:COLOR_SUB });
    const details2 = [client.contactEmail, client.contactPhone].filter(Boolean).join(" · ");
    tx(s, details2, { x:0.8, y:2.1, w:11.5, fontSize:12, color:COLOR_MUTED });
  }

  // PRODUCTS
  for (const row of products) {
    if (DEBUG_LOG_ROWS && !row.__logged) {
      console.log("EXPORT ROW KEYS:", Object.keys(row));
      row.__logged = true;
    }

    const productName = val(row, ["Name","Product"]);
    const productCode = val(row, ["Code","SKU","Product Code"]);
    const imageUrl    = val(row, ["ImageURL","Image","Image Url","imagebox","image_box","Thumbnail"]);
    const pdfUrl      = val(row, ["PdfURL","PDF URL","Specs PDF","Spec","SpecsUrl"]);
    const description = val(row, ["Description","Product Description"]);
    const specsStr    = val(row, ["Specs","Specifications"], "");
    const bullets     = specsStr ? specsStr.split(/\r?\n|,|•/).map(s => s.trim()).filter(Boolean) : undefined;

    const s = pptx.addSlide({ masterName: "PRODUCT" });

    // Left image (through proxy)
    if (imageUrl) {
      try {
        const d = await fetchAsDataUrl(imageUrl);
        s.addImage({ data: stripDataPrefix(d), ...PRODUCT.img, sizing: { type: "contain", w: PRODUCT.img.w, h: PRODUCT.img.h } });
      } catch { /* ignore */ }
    }

    // Right specs: first page of PDF -> bullets -> link
    let specsDrawn = false;
    if (pdfUrl) {
      try {
        const png = await renderPdfFirstPageToDataUrl(viaProxy(pdfUrl)!, 1200);
        s.addImage({ data: stripDataPrefix(png), ...PRODUCT.specs, sizing: { type: "contain", w: PRODUCT.specs.w, h: PRODUCT.specs.h } });
        specsDrawn = true;
      } catch { /* fall through */ }
    }
    if (!specsDrawn && bullets?.length) {
      tx(s, bullets.map(b => `• ${b}`).join("\n"), {
        x: PRODUCT.specs.x, y: PRODUCT.specs.y, w: PRODUCT.specs.w, h: PRODUCT.specs.h,
        fontSize: 12, color: COLOR_SUB,
      });
      specsDrawn = true;
    }
    if (!specsDrawn && pdfUrl) {
      tx(s, "View full specification PDF", {
        x: PRODUCT.specs.x, y: PRODUCT.specs.y, w: PRODUCT.specs.w, h: 0.32,
        fontSize: 12, color: "2563EB", hyperlink: { url: pdfUrl }
      });
    }

    // Title / description / code (autoshrink + trimmed description)
    const titleText = productName || "Product";
    tx(s, titleText, { ...PRODUCT.title, fontSize: autoTitleSize(titleText), bold:true, color:COLOR_TEXT, align:"center" });
    const desc = trimDesc(description, 220);
    if (desc) tx(s, desc, { ...PRODUCT.desc, fontSize:12, color:COLOR_SUB, align:"center" });
    if (productCode) tx(s, productCode, { ...PRODUCT.code, fontSize:11, color:COLOR_TEXT, align:"center" });

    // Footer bar
    s.addShape(PptxGenJS.ShapeType.rect, { ...PRODUCT.footer.bar, fill: { color: COLOR_FOOTER } });
    s.addImage({ path: "/logo.png", x: 0.3, y: 7.0, w: 1.0, h: 0.3 });
    tx(s, "Pacific Bathroom · Project Selections", {
      x: PRODUCT.footer.text.x, y: PRODUCT.footer.text.y, w: PRODUCT.footer.text.w,
      fontSize: 10, color: "FFFFFF", align: "left",
    });
  }

  // Tail slides (blank)
  pptx.addSlide({ masterName: "END1" });
  pptx.addSlide({ masterName: "END2" });

  await pptx.writeFile({ fileName: `${client.projectName || "Project Selection"}.pptx` });
}