// at top (near other helpers)
const FULL_W = 10;      // pptxgenjs default 16:9 width (inches)
const FULL_H = 5.625;   // pptxgenjs default 16:9 height

async function exportPptx() {
  if (selectedList.length === 0) return alert("Select at least one product.");
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // ----- two bathroom cover photos first -----
  for (const url of ["/pptx/cover1.jpg", "/pptx/cover2.jpg"]) {
    try {
      const dataUrl = await urlToDataUrl(url);
      const s = pptx.addSlide();
      s.addImage({ data: dataUrl, x: 0, y: 0, w: FULL_W, h: FULL_H, sizing: { type: "cover", w: FULL_W, h: FULL_H } } as any);
    } catch {}
  }

  // (optional) remove this simple title slide if you don't want it)
  // pptx.addSlide().addText([...], { x: 0.6, y: 0.6, w: 12, h: 6 });

  // ----- product slides -----
  for (const p of selectedList) {
    const s = pptx.addSlide();
    try {
      if (p.imageProxied) {
        const dataUrl = await urlToDataUrl(p.imageProxied);
        s.addImage({ data: dataUrl, x: 0.5, y: 0.7, w: 5.5, h: 4.1, sizing: { type: "contain", w: 5.5, h: 4.1 } } as any);
      }
    } catch {}

    // real bullets for specs + description/category
    const textRuns: any[] = [];
    if (p.description) textRuns.push({ text: p.description + "\n", options: { fontSize: 12 } });
    if (p.specsBullets?.length) {
      for (const b of p.specsBullets) textRuns.push({ text: b, options: { fontSize: 12, bullet: true } });
    }
    if (p.category) textRuns.push({ text: `\nCategory: ${p.category}`, options: { fontSize: 11 } });
    if (textRuns.length) s.addText(textRuns, { x: 6.2, y: 1.9, w: 6.2, h: 3.7 });

    s.addText((p.name ?? "—").trim() || "—", { x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true });
    s.addText(p.code ? `SKU: ${p.code}` : "", { x: 6.2, y: 1.4, w: 6.2, h: 0.4, fontSize: 12 });
    if (p.url)    s.addText("Product page",     { x: 6.2, y: 5.8, w: 6.2, h: 0.4, fontSize: 12, underline: true, hyperlink: { url: p.url } });
    if (p.pdfUrl) s.addText("Spec sheet (PDF)", { x: 6.2, y: 6.2, w: 6.2, h: 0.4, fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl } });
  }

  // ----- back pages: warranty then service -----
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
