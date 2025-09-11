// src/types.ts
export type Asset = { url: string; label?: string };

export type Product = {
  id: string;
  code?: string;
  name?: string;
  brand?: string;
  category?: string;
  image?: string;          // absolute URL preferred
  gallery?: string[];
  description?: string;
  features?: string[];
  specs?: unknown;         // can be [{label,value}] | string[] | Record<string,unknown>
  compliance?: string[];
  tags?: string[];
  sourceUrl?: string;
  specPdfUrl?: string;
  assets?: Asset[];
};

// src/types.ts
export type ClientInfo = {
  clientName: string;
  projectName: string;
  dateISO?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

// Minimal section type so older code (exporters/drawer) compiles
export type Section = {
  id: string;
  title: string;
};


  // Contact fields (bring back the inputs you had earlier)
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};
