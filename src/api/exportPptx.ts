// src/api/exportPptx.ts
import PptxGenJS from "pptxgenjs";
// ... your other imports

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const blob = await res.blob();
  const buf = await blob.arrayBuffer();
  const bin = typeof window !== "undefined" ? String.fromCharCode(...new Uint8Array(buf)) : "";
  return `data:${blob.type};base64,${btoa(bin)}`;
}

// when building each product slide:
if (p.imageUrl || p.thumbnail) {
  try {
    const b64 = await urlToBase64(String(p.imageUrl || p.thumbnail));
    slide.addImage({
      data: b64,
      x: 0.6, y: 1.4, w: 5.5, h: 4.0, // adjust to match your layout
      // keepAspectRatio is automatic when only w or h is set,
      // here we control both, so set/clip as you prefer
    });
  } catch (e) {
    console.warn("Image skipped:", e);
  }
}

// Product title / code / description (example)
slide.addText(p.product || "", { x: 0.6, y: 0.7, w: 8.0, h: 0.6, fontSize: 20, bold: true });
slide.addText(p.description || "", { x: 0.6, y: 5.6, w: 8.0, h: 1.0, fontSize: 12 });
if (p.sku || p.code) slide.addText(String(p.sku || p.code), { x: 0.6, y: 6.7, w: 8.0, h: 0.4, fontSize: 11 });

// Spec “image” (reliable fallback = clickable link)
if (p.pdfUrl || p.pdf_url) {
  const url = String(p.pdfUrl || p.pdf_url);
  slide.addText("View Specifications", {
    x: 6.4, y: 1.0, w: 3.3, h: 0.4, fontSize: 12, color: "0088ff", underline: true,
    hyperlink: { url }
  });
}
