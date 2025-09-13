// src/utils/exportSection.ts
import { exportDeckFromProducts } from "./pptExporter";
import type { ClientInfo, Product } from "../types";

/**
 * Legacy Section shape (compat only). We only care about `title` and `products`.
 * Keep it local to this file so other parts of the app can ignore it.
 */
export type LegacySection = {
  id?: string;
  title?: string;
  products?: Product[]; // <-- plural; old code sometimes used `product`
};

/**
 * Export a single section using the new PPT exporter.
 * This replaces any old per-section export that referenced `section.product`.
 */
export async function exportSectionPptx(section: LegacySection, client: ClientInfo) {
  const items: Product[] = Array.isArray(section?.products) ? section.products : [];
  await exportDeckFromProducts({ client, products: items });
}

/**
 * Export multiple sections in one deck (products concatenated in order).
 * Keeps old call sites working without relying on `section.product`.
 */
export async function exportSectionsPptx(sections: LegacySection[], client: ClientInfo) {
  const all: Product[] = [];
  for (const s of sections || []) {
    if (Array.isArray(s?.products)) all.push(...s.products);
  }
  await exportDeckFromProducts({ client, products: all });
}

/**
 * Back-compat default export if some files import a default symbol.
 * You can remove this once all old imports are updated.
 */
export default {
  exportSectionPptx,
  exportSectionsPptx,
};