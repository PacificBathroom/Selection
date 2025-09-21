// src/api/exportPptx.ts
import type { Product, ClientInfo } from "../types";

export async function exportPptx(rows: Product[], client: ClientInfo) {
  const res = await fetch("/api/export-pptx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows, client }),
  });
  if (!res.ok) throw new Error(await res.text());

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${client.projectName || "Project Selection"}.pptx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}