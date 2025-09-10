export type Asset = { label: string; url: string };

export type Product = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  image?: string;
  gallery?: string[];
  features?: string[];
  specs?: { label: string; value: string }[];
  compliance?: string[];
  tags?: string[];
  brand?: string;
  category?: string;
  sourceUrl?: string;

  // NEW: picked by the scraper (best PDF that looks like a spec/data sheet)
  specPdfUrl?: string;

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
  product?: any; // keep your existing shape if you had one
};
