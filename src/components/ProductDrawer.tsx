// src/components/ProductDrawer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Product } from '../types';
import Tag from './Tag';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import logo from '../assets/logo.png';

type Props = {
  product: Product | null;
  onClose: () => void;
};

export default function ProductDrawer({ product, onClose }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Header details (editable in Header.tsx; read here for PDF header)
  const [projectName, setProjectName] = useState<string>('Pacific Bathroom Project');
  const [contactName, setContactName] = useState<string>('Your Name');
  const [contactEmail, setContactEmail] = useState<string>('you@example.com');
  const [contactPhone, setContactPhone] = useState<string>('0000 000 000');
  const [jobDate, setJobDate] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  });

  useEffect(() => {
    const pn = localStorage.getItem('projectName');
    const cn = localStorage.getItem('contactName');
    const ce = localStorage.getItem('contactEmail');
    const cp = localStorage.getItem('contactPhone');
    const jd = sessionStorage.getItem('jobDate');
    if (pn) setProjectName(pn);
