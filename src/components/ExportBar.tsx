import { useState } from "react";
import { fetchProducts } from "@/api/sheets";
import { exportPptx } from "@/api/exportPptx";
import type { ClientInfo, Product } from "@/types";

export default function ExportBar() {
  const [client, setClient] = useState<ClientInfo>({
    projectName: "",
    clientName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: ""
  });
  const [isExporting, setIsExporting] = useState(false);

  async function onExport() {
    try {
      setIsExporting(true);
      const products: Product[] = await fetchProducts(); // or your selected subset
      if (!products.length) {
        alert("No products found to export.");
        return;
      }
      await exportPptx(products, client);
    } catch (e: any) {
      console.error(e);
      alert(`Export failed: ${e?.message || e}`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Your inputs */}
      <div className="grid grid-cols-2 gap-2">
        <input
          className="border p-2"
          placeholder="Project name"
          value={client.projectName ?? ""}
          onChange={e => setClient(c => ({ ...c, projectName: e.target.value }))}
        />
        <input
          className="border p-2"
          placeholder="Client name"
          value={client.clientName ?? ""}
          onChange={e => setClient(c => ({ ...c, clientName: e.target.value }))}
        />
        <input
          className="border p-2"
          placeholder="Contact name"
          value={client.contactName ?? ""}
          onChange={e => setClient(c => ({ ...c, contactName: e.target.value }))}
        />
        <input
          className="border p-2"
          placeholder="Email"
          value={client.contactEmail ?? ""}
          onChange={e => setClient(c => ({ ...c, contactEmail: e.target.value }))}
        />
        <input
          className="border p-2"
          placeholder="Phone"
          value={client.contactPhone ?? ""}
          onChange={e => setClient(c => ({ ...c, contactPhone: e.target.value }))}
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
