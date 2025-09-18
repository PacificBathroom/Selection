// src/types.ts

export interface ClientInfo {
  projectName?: string;
  clientName?: string;
  dateISO?: string;

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface Product {
  // Primary
  id?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  pdfUrl?: string;
  code?: string;
  category?: string;
  price?: string | number;
  specs?: string[];

  // Legacy aliases
  product?: string;
  sku?: string;
  image?: string;
  thumbnail?: string;
  specPdfUrl?: string;
  specifications?: string;
  sourceUrl?: string;
  features?: string[];
}

export interface Section {
  title?: string;
  products?: Product[];
}
