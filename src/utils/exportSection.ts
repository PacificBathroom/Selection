// src/utils/exportSection.ts
import { exportDeckFromProducts } from "./pptExporter";
import type { ClientInfo, Product } from "../types";

/**
 * Section shape — supports both `products` (new) and `product` (old).
 */
export type Section = {
  id?: string;
  title?: string;
  products?: Product[];
  /** @deprecated kept for backward compatibility */
  product?: Product | Product[];
};

/**
 * Normalise section to always return an array of products.
 * Falls back to `product` if defined.
 */
function normalizeProducts(section: Section): Product[] {
  if (Array.isArray(section.products)) return section.products;
  if (section.product) {
    return Array.isArray(section.product) ? section.product : [section.product];
  }
  return [];
}

/**
 * Export a single section as a PPTX.
 */
export async function exportSection(section: Section, client: ClientInfo) {
  const items = normalizeProducts(section);
  await exportDeckFromProducts({ client, products: items });
}

/**
 * Export multiple sections into a single PPTX.
 * Concatenates all products in order.
 */
export async function exportSections(sections: Section[], client: ClientInfo) {
  const all: Product[] = [];
  for (const s of sections || []) {
    all.push(...normalizeProducts(s));
  }
  await exportDeckFromProducts({ client, products: all });
}

export default {
  exportSection,
  exportSections,
};