// src/components/ExportBar.tsx
import { useState } from "react";
import type { Product, ClientInfo } from "@/types";
import { exportPptxV2 } from "@/api/exportPptx";
import { exportPptxV2 } from "@/api/exportPptx.v2"; // use "../api/exportPptx.v2" if you don't have "@/"


type Props = {
  /** Optional: pass the ticked items from your list UI */
  selectedRows?: Product[];
};

export default function ExportBar({ selectedRows }: Props) {
  const [client, setClient] = useState<ClientInfo>({
    projectName: "",
    clientName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [isExporting, setIsExporting] = useState(false);

  const onExport = async () => {
    try {
      setIsExporting(true);

      // Use selectedRows when provided; otherwise fetch (or fetch only selected in your fetchProducts)
      let rows: Product[] =
        selectedRows && selectedRows.length ? selectedRows : await fetchProducts();

      if (!rows || rows.length === 0) {
        alert("Select at least one product to export.");
        return;
      }

      await exportPptxV2(rows, client);
    } catch (e: any) {
      console.error("[export] failed:", e);
      alert(`Export failed: ${e?.message || e}`);
    } finally {
      setIsExporting(false);
    }
  };
async function onExport() {
    if (!selectedRows?.length) {
      alert("Select at least one product first.");
      return;
    }
    setIsExporting(true);
    try {
      // <- call it here (this is the line you asked about)
      await exportPptxV2(selectedRows, clientInfo);
    } catch (e: any) {
      console.error(e);
      alert(`Export failed: ${e?.message || e}`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          className="border p-2"
          placeholder="Project name"
          value={client.projectName ?? ""}
          onChange={(e) => setClient((c) => ({ ...c, projectName: e.target.value }))}
        />
        <input
          className="border p-2"
          placeholder="Client name"
          value={client.clientName ?? ""}
          onChange={(e) => setClient((c) => ({ ...c, clientName: e.target.value }))}
        />
        <input
          className="border p-2"
          placeholder="Contact name"
          value={client.contactName ?? ""}
          onChange={(e) => setClient((c) => ({ ...c, contactName: e.target.value }))}
        />
        <input
          className="border p-2"
          placeholder="Email"
          value={client.contactEmail ?? ""}
          onChange={(e) => setClient((c) => ({ ...c, contactEmail: e.target.value }))}
        />
        <input
          className="border p-2"
          placeholder="Phone"
          value={client.contactPhone ?? ""}
          onChange={(e) => setClient((c) => ({ ...c, contactPhone: e.target.value }))}
        />
      </div>

      <button
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={isExporting}
        onClick={onExport}
      >
        {isExporting ? "Exporting…" : "Export PPTX"}
      </button>
    </div>
  );
}
