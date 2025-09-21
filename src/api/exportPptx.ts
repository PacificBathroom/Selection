// Build up to 12 spec rows from various shapes of input
function toSpecPairs(row: Record<string, any>): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];

  // Array form: [{ label, value }]
  if (Array.isArray((row as any).specs)) {
    for (const it of (row as any).specs as Array<{ label?: string; value?: string }>) {
      const label = String(it?.label ?? "").trim();
      const value = String(it?.value ?? "").trim();
      if (label || value) pairs.push([label, value]);
    }
  }

  // Long text forms: include "SpecsBullets" explicitly
  const long =
    str(getField(row, [
      "SpecsBullets",            // <— NEW
      "Specifications",
      "Specs",
      "Product Details",
      "Details",
      "Features",
      "Notes",
    ])) ||
    str((row as any).specifications) ||
    str((row as any).specs) ||
    str((row as any).SpecsBullets);     // <— NEW

  if (!pairs.length && long) {
    for (const part of long.split(/\r?\n|[|•]/).map((s) => s.trim()).filter(Boolean)) {
      const m = part.match(/^(.+?)\s*[:\-–]\s*(.+)$/);
      if (m) pairs.push([m[1].trim(), m[2].trim()]);
      else pairs.push(["", part]); // items without ":" become single-value rows
      if (pairs.length >= 12) break;
    }
  }

  // Header/value fall-back (kept as-is)
  if (!pairs.length) {
    const SPECY = [
      "Material", "Finish", "Mounting", "Features", "Options", "Dimensions",
      "Size", "Capacity", "Power", "Model", "Warranty", "Colour", "Color",
    ].map(norm);

    for (const key of Object.keys(row)) {
      const nk = norm(key);
      if (
        ["name","product","title","code","sku","image","imageurl","photo","thumbnail","url","link",
         "pdf","pdfurl","specpdfurl","description","desc","shortdescription","longdescription","specsbullets"]
          .includes(nk)
      ) continue;

      const val = String(row[key] ?? "").trim();
      if (!val) continue;

      if (SPECY.includes(nk) || val.length <= 120) {
        pairs.push([key.replace(/\s+/g, " ").trim(), val]);
      }
      if (pairs.length >= 12) break;
    }
  }

  return pairs.slice(0, 12);
}