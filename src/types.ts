// src/types.ts

/** Entered in the app (not from spreadsheet) */
export interface ClientInfo {
  projectName?: string;
  clientName?: string;
  dateISO?: string;

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/**
 * Canonical product shape + legacy aliases so older components keep working.
 * Primary fields you should rely on going forward:
 *   name, description, imageUrl, pdfUrl, code, category, price, specs
 * Aliases kept to satisfy existing code during the transition.
 */
export interface Product {
  // Primary
  name?: string;
  description?: string;
  imageUrl?: string;
  pdfUrl?: string;
  code?: string;
  category?: string;
  price?: string | number;
  specs?: string[];

  // ---- Legacy aliases (read/write for compatibility) ----
  product?: string;          // alias of name
  sku?: string;              // alias of code
  image?: string;            // alias of imageUrl
  thumbnail?: string;        // alias of imageUrl
  specPdfUrl?: string;       // alias of pdfUrl
  specifications?: string;   // optional long text
  sourceUrl?: string;        // some exporters use this
  features?: string[];       // some exporters use this
}

/** Logical grouping of products */
export interface Section {
  title?: string;
  products?: Product[];
}
