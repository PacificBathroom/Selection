// src/types.ts

export type Asset = {
  label?: string;
  href?: string;   // <— ensure href exists (optional)
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
  assets?: Asset[];    // <— aligns with SectionSlide usage
  sourceUrl?: string;
  export type ClientInfo = {
  projectName: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  jobDate?: string; // ISO YYYY-MM-DD
};

};

export type Section = {
  id: string;
  title: string;
  product?: Product;   // use undefined (not null) when empty
};
