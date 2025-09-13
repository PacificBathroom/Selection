// src/utils/exportSection.ts
import { exportDeckFromProducts } from "./pptExporter";
import type { ClientInfo, Product } from "../types";

/**
 * Section shape — we only need `title` and `products`.
 * This replaces the old `section.product` references.
 */
export type Section = {
  id?: string;
  title?: string;
  products?: Product[];
};

/**
 * Export a single section as a PPTX.
 * (Matches old function name/signature for compatibility.)
 */
export async function exportSection(section: Section, client: ClientInfo) {
  const items: Product[] = Array.isArray(section?.products) ? section.products : [];
  await exportDeckFromProducts({ client, products: items });
}

/**
 * Export multiple sections into a single PPTX.
 * Concatenates all products in order.
 */
export async function exportSections(sections: Section[], client: ClientInfo) {
  const all: Product[] = [];
  for (const s of sections || []) {
    if (Array.isArray(s?.products)) all.push(...s.products);
  }
  await exportDeckFromProducts({ client, products: all });
}

export default {
  exportSection,
  exportSections,
};