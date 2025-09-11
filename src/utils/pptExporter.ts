/* --- PRODUCT SLIDES --- */
for (const raw of products) {
  const productName = String((raw as any).name ?? (raw as any).product ?? "Product");
  const productCode = String((raw as any).code ?? "");
  const imageUrl    = String((raw as any).image ?? (raw as any).imageurl ?? "");
  const pdfUrl      = String((raw as any).pdfurl ?? "");
  const description = String((raw as any).description ?? "");
  const specsBullets = (raw as any).specs as string[] | undefined;

  const s = pptx.addSlide({ masterName: "PRODUCT" });

  // left image
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

  // right specs
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
  if (!specsDrawn && specsBullets && specsBullets.length) {
    tx(s, specsBullets.map((b) => `• ${b}`).join("\n"), {
      x: PRODUCT.specs.x, y: PRODUCT.specs.y, w: PRODUCT.specs.w, h: PRODUCT.specs.h,
      fontSize: 12, color: COLOR_SUB,
    });
  }

  // title / desc / code
  tx(s, productName, {
    ...PRODUCT.title,
    fontSize: autoTitleSize(productName),
    bold: true,
    color: COLOR_TEXT,
    align: "center",
  });
  if (description) tx(s, description, {
    ...PRODUCT.desc, fontSize: 12, color: COLOR_SUB, align: "center",
  });
  if (productCode) tx(s, productCode, {
    ...PRODUCT.code, fontSize: 11, color: COLOR_TEXT, align: "center",
  });

  // --- FOOTER BAR (new) ---
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 6.8, w: "100%", h: 0.4,
    fill: { color: "0F172A" },
  });
  s.addImage({
    path: "/logo.png",
    x: 0.3, y: 6.85, w: 1.0, h: 0.3,
  });
  tx(s, "Pacific Bathroom · Project Selections", {
    x: 1.5, y: 6.85, w: 11,
    fontSize: 10, color: "FFFFFF", align: "left",
  });
}
