// src/types.ts

export type Asset = {
  label?: string;
  href?: string;
  url?: string; // allow either href or url
};

export type Spec = {
  label: string;
  value: string;
};

export type Product = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  image?: string;
  gallery?: string[];
  features?: string[];
  specs?: Spec[];
  price?: string;
  assets?: Asset[];
  sourceUrl?: string;

  // extras used in UI
  tags?: string[];
  compliance?: string[];
  brand?: string;
};

export type Section = {
  id: string;
  title: string;
  product?: Product; // undefined when empty
};

export type ClientInfo = {
  projectName: string;
  clientName?: string;   // alias
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  jobDate?: string;      // ISO date
  dateISO?: string;      // alias
};
