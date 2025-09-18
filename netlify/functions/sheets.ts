/* ---------- workbook loader with header detection ---------- */
async function loadAllProducts(range?: string): Promise<Product[]> {
  if (__productsCache && !range) return __productsCache;

  const XLSX = await import("xlsx");
  const res = await fetch("/assets/precero.xlsx", { cache: "no-cache" });

  if (!res.ok) {
    throw new Error(
      `❌ Could not load product data. Expected /assets/precero.xlsx but got ${res.status} ${res.statusText}.
Make sure the file exists in /public/assets/precero.xlsx and is deployed correctly.`
    );
  }

  try {
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });

    // Resolve sheet + optional A1 range
    let sheetName: string | undefined;
    let a1: string | undefined;

    if (range) {
      if (range.includes("!")) {
        const [sn, r] = range.split("!");
        sheetName = sn || undefined;
        a1 = r || undefined;
      } else if (/^[A-Z]+(?:\d+)?:[A-Z]+(?:\d+)?$/i.test(range)) {
        a1 = range;
      } else {
        sheetName = range;
      }
    }
    if (!sheetName) {
      sheetName = wb.SheetNames.find((n) => n.toLowerCase() === "products") || wb.SheetNames[0];
    }

    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error(`❌ Sheet "${sheetName}" not found in precero.xlsx`);

    // Read as matrix to auto-find header row (one that contains "name")
    const matrix = XLSX.utils.sheet_to_json<any[]>(ws, {
      header: 1,
      defval: "",
      blankrows: false,
      ...(a1 ? { range: a1 } : {}),
    }) as any[][];

    if (!Array.isArray(matrix) || matrix.length === 0) {
      throw new Error("❌ precero.xlsx is empty or could not be read.");
    }

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(matrix.length, 50); i++) {
      const row = matrix[i] || [];
      if (row.some((cell) => norm(cell) === "name")) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx === -1) headerRowIdx = 0;

    const headers = (matrix[headerRowIdx] || []).map((h: any) => String(h ?? ""));
    const dataRows = matrix.slice(headerRowIdx + 1);

    const objects: Record<string, any>[] = dataRows.map((arr) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => (obj[h] = arr[i]));
      return obj;
    });

    const products = objects
      .map(toProduct)
      .filter((p) => p.name || p.description || p.imageUrl || p.pdfUrl);

    if (!range) __productsCache = products;
    return products;
  } catch (err: any) {
    throw new Error(`❌ Failed to parse precero.xlsx: ${err.message}`);
  }
}
