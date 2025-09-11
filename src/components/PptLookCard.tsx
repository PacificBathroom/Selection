// src/components/PptLookCard.tsx
import { slideTheme as t } from "../theme/slideTheme";
import type { ProductRow } from "../api/sheets";

export function PptLookCard({ p, logoUrl }: { p: ProductRow; logoUrl?: string }) {
  return (
    <div
      style={{
        fontFamily: t.fontFamily,
        background: t.cardBg,
        borderRadius: t.radius,
        boxShadow: t.cardShadow,
        padding: "16px",
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: "16px",
      }}
    >
      {p.thumbnail ? (
        <img
          src={String(p.thumbnail)}
          alt={String(p.product || "Product")}
          style={{ width: "140px", height: "140px", objectFit: "cover", borderRadius: "12px" }}
          loading="lazy"
        />
      ) : (
        <div style={{ width: 140, height: 140, borderRadius: 12, background: "#F3F4F6" }} />
      )}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ color: t.title, fontSize: 20, fontWeight: 700, margin: 0 }}>
            {p.product || "Untitled product"}
          </h3>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ height: 28, objectFit: "contain", opacity: 0.9 }} />
          ) : null}
        </div>

        <div style={{ color: t.meta, fontSize: 12, marginBottom: 8 }}>
          {p.sku ? <>SKU: {p.sku} · </> : null}
          {p.category ? <>Category: {p.category}</> : null}
        </div>

        {p.description ? (
          <p style={{ margin: 0, color: "#374151", lineHeight: 1.4 }}>
            {String(p.description).slice(0, 220)}
            {String(p.description).length > 220 ? "…" : ""}
          </p>
        ) : null}

        {p.price != null && String(p.price).trim() !== "" ? (
          <div style={{ marginTop: 10, fontWeight: 700 }}>
            {typeof p.price === "number" ? `$${p.price.toFixed(2)}` : p.price}
          </div>
        ) : null}
      </div>
    </div>
  );
}
