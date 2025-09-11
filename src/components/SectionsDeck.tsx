// src/components/SectionsDeck.tsx
import React from "react";
import type { Section, ClientInfo } from "../types";

type Props = {
  client: ClientInfo;
  setClient: (next: ClientInfo) => void;
  sections: Section[];
  setSections: (next: Section[]) => void;
};

export default function SectionsDeck(_: Props) {
  // Sections are no longer used; keep a stub so imports (if any) won't break.
  return null;
}
