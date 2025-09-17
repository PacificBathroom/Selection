// src/components/PptLookCard.tsx
import { slideTheme as t } from "../theme/slideTheme";
import type { ProductRow } from "../api/sheets";

export function PptLookCard({ p, logoUrl }: { p: ProductRow; logoUrl?: string }) {
  const title = p.name ?? p.product?.name ?? "Untitled product";
  const thumb = p.thumbnail ?? p.imageUrl ?? p.image;
  const sku = p.sku ? String(p.sku) : p.code ? String(p.code) : "";
  const category = p.category ? String(p.category) : "";

  const priceText =
    p.price != null && String(p.price).trim() !== ""
      ? typeof p.price === "number"
        ? `$${p.price.toFixed(2)}`
        : String(p.price)
      : "";

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
      {thumb ? (
        <img
          src={String(thumb)}
          alt={title}
          style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 12 }}
          loading="lazy"
        />
      ) : (
        <div style={{ width: 140, height: 140, borderRadius: 12, background: "#F3F4F6" }} />
      )}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ color: t.title, fontSize: 20, fontWeight: 700, margin: 0 }}>{title}</h3>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ height: 28, objectFit: "contain", opacity: 0.9 }} />
          ) : null}
        </div>

        <div style={{ color: t.meta, fontSize: 12, marginBottom: 8 }}>
          {sku && <>SKU/Code: {sku} · </>}
          {category && <>Category: {category}</>}
        </div>

        {p.description ? (
          <p style={{ margin: 0, color: "#374151", lineHeight: 1.4 }}>
            {String(p.description).slice(0, 220)}
            {String(p.description).length > 220 ? "…" : ""}
          </p>
        ) : null}

        {priceText ? <div style={{ marginTop: 10, fontWeight: 700 }}>{priceText}</div> : null}
      </div>
    </div>
  );
}
