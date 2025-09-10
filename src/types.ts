// src/types.ts
export type Asset = {
  url: string;
  label?: string;
};

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
  assets?: Asset[]; // unified type
};

export type Section = {
  id: string;
  title: string;
  product?: Product;      // legacy single
  products?: Product[];   // new multiple
};

export type ClientInfo = {
  clientName: string;
  projectName: string;
  dateISO?: string;

  // These are used by FrontPage.tsx:
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};
