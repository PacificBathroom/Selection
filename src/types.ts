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
  assets?: Asset[]; // << unified here
};

export type Section = {
  id: string;
  title: string;
  // legacy single:
  product?: Product;
  // new multi:
  products?: Product[];
};

export type ClientInfo = {
  clientName: string;
  projectName: string;
  dateISO?: string;
};
