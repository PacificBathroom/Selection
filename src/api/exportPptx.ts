// helper keeps working in browser (turns a URL into a data: URL)
async function urlToDataUrl(url: string): Promise<string> {
  const r = await fetch(url, { cache: "no-store" });
  const b = await r.blob();
  return await new Promise((res) => {
    const fr = new FileReader();
    fr.onloadend = () => res(String(fr.result));
    fr.readAsDataURL(b);
  });
}

async function exportPptx() {
  if (selectedList.length === 0) return alert("Select at least one product.");

  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // --- TWO COVERS (bathroom photos) ---
  for (const path of ["/cover-1.jpg", "/cover-2.jpg"]) {
    try {
      const data = await urlToDataUrl(path);
      pptx.addSlide().addImage({ data, x: 0, y: 0, w: 10, h: 5.625 }); // full bleed 16:9
    } catch {}
  }

  // --- OPTIONAL TITLE SLIDE WITH FORM DETAILS (keep/remove as you like) ---
  pptx.addSlide().addText(
    [
      { text: projectName || "Project Selection", options: { fontSize: 28, bold: true } },
      { text: clientName ? `\nClient: ${clientName}` : "", options: { fontSize: 18 } },
      { text: contactName ? `\nPrepared by: ${contactName}` : "", options: { fontSize: 16 } },
      { text: email ? `\nEmail: ${email}` : "", options: { fontSize: 14 } },
      { text: phone ? `\nPhone: ${phone}` : "", options: { fontSize: 14 } },
      { text: date ? `\nDate: ${date}` : "", options: { fontSize: 14 } },
    ],
    { x: 0.6, y: 0.6, w: 12, h: 6 }
  );

  // --- PRODUCT SLIDES ---
  for (const p of selectedList) {
    const s = pptx.addSlide();

    // image (proxy keeps cross-origin happy)
    try {
      if (p.imageProxied) {
        const dataUrl = await urlToDataUrl(p.imageProxied);
        s.addImage({ data: dataUrl, x: 0.5, y: 0.7, w: 5.5, h: 4.1, sizing: { type: "contain", w: 5.5, h: 4.1 } });
      }
    } catch {}

    // left text block
    s.addText((p.name ?? "—"), { x: 6.2, y: 0.7, w: 6.2, h: 0.6, fontSize: 20, bold: true });
    if (p.code) s.addText(`SKU: ${p.code}`, { x: 6.2, y: 1.4, w: 6.2, h: 0.4, fontSize: 12 });

    // description + **bulleted** specs
    const textRuns: any[] = [];
    if (p.description) textRuns.push({ text: p.description + "\n", options: { fontSize: 12 } });
    if (p.specsBullets?.length) {
      for (const t of p.specsBullets) {
        textRuns.push({ text: t, options: { fontSize: 12, bullet: true } });
      }
    }
    if (p.category) textRuns.push({ text: `\nCategory: ${p.category}`, options: { fontSize: 11 } });
    if (textRuns.length) s.addText(textRuns, { x: 6.2, y: 1.9, w: 6.2, h: 3.7 });

    // links
    if (p.url)     s.addText("Product page",   { x: 6.2, y: 5.8, w: 6.2, h: 0.4, fontSize: 12, underline: true, hyperlink: { url: p.url } });
    if (p.pdfUrl)  s.addText("Spec sheet (PDF)", { x: 6.2, y: 6.2, w: 6.2, h: 0.4, fontSize: 12, underline: true, hyperlink: { url: p.pdfUrl } });
  }

  // --- BACK PAGES (Warranty then Service) ---
  for (const path of ["/warranty.jpg", "/service.jpg"]) {
    try {
      const data = await urlToDataUrl(path);
      pptx.addSlide().addImage({ data, x: 0, y: 0, w: 10, h: 5.625 });
    } catch {}
  }

  const filename = `${(projectName || "Selection").replace(/[^\w-]+/g, "_")}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
