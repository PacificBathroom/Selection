export type Asset = { label: string; url: string };

export type Product = {
  id: string;
  code?: string;
  name?: string;
  brand?: string;
  category?: string;
  image?: string;
  gallery?: string[];
  description?: string;
  features?: string[];
  specs?: any[];
  compliance?: string[];
  tags?: string[];
  sourceUrl?: string;
  specPdfUrl?: string;
  assets?: string[];

  // optional: all discovered PDFs/links
  assets?: Asset[];
};

// src/types.ts
export type ClientInfo = {
  projectName: string;
  clientName: string;
  dateISO?: string;          // "YYYY-MM-DD"
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

export type Section = {
  id: string;
  title: string;
  product?: Product;      // legacy (single)
  products?: Product[];   // new (multiple)
};
