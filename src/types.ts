// src/types.ts
export interface Section {
  id?: string;
  title: string;
  products: Product[]; // the products that belong in this section
}

export interface Product {
  // identifiers
  name?: string;
  product?: string;
  code?: string;
  sku?: string;
  url?: string;

  // media
  imageUrl?: string;
  image?: string;
  thumbnail?: string;

  // copy
  description?: string;

  // specs
  specs?: { label?: string; value?: string }[] | string;
  specifications?: string;

  // pdf/spec sheets
  pdfUrl?: string;
  specPdfUrl?: string;

  // category
  category?: string;

  // per-row contact (optional fallback for slides/UX)
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;

  // selection flag (if you use it)
  selected?: boolean;

  [key: string]: any; // keep flexible
}

export interface ClientInfo {
  projectName?: string;
  clientName?: string;
  dateISO?: string;

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
}
