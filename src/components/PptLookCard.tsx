import React from "react";
import type { Product } from "@/types";

export function PptLookCard({ p, logoUrl }: { p: Product; logoUrl?: string }) {
  const title = p.name?.toString() || "Untitled product";
  const img = p.imageUrl || p.image || "";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow:
          "0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)",
        padding: 16,
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 16,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial",
      }}
    >
      {/* Thumbnail */}
      {img ? (
        <img
          src={img}
          alt={title}
          style={{
            width: 140,
            height: 140,
            objectFit: "cover",
            borderRadius: 12,
            background: "#F3F4F6",
          }}
          loading="lazy"
        />
      ) : (
        <div
          style={{ width: 140, height: 140, borderRadius: 12, background: "#F3F4F6" }}
        />
      )}

      {/* Meta */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
            {title}
          </h3>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              style={{ height: 28, objectFit: "contain", opacity: 0.9 }}
            />
          ) : null}
        </div>

        <div style={{ color: "#6B7280", fontSize: 12, marginBottom: 8 }}>
          {p.code ? <>Code: {p.code} · </> : null}
          {p.category ? <>Category: {p.category}</> : null}
        </div>

        {p.description ? (
          <p style={{ margin: 0, color: "#374151", lineHeight: 1.4 }}>
            {String(p.description).slice(0, 220)}
            {String(p.description).length > 220 ? "…" : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
