import React, { useEffect, useState } from 'react';
import { LOGO_URL } from '../constants/brand';

export default function Header() {
  const [projectName, setProjectName] = useState('Pacific Bathroom Project');
  const [contactName, setContactName] = useState('Your Name');
  const [contactEmail, setContactEmail] = useState('you@example.com');
  const [contactPhone, setContactPhone] = useState('0000 000 000');
  const [jobDate, setJobDate] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  });

  // Persist edits (so Drawer can read them)
  useEffect(() => {
    localStorage.setItem('projectName', projectName);
  }, [projectName]);
  useEffect(() => {
    localStorage.setItem('contactName', contactName);
  }, [contactName]);
  useEffect(() => {
    localStorage.setItem('contactEmail', contactEmail);
  }, [contactEmail]);
  useEffect(() => {
    localStorage.setItem('contactPhone', contactPhone);
  }, [contactPhone]);
  useEffect(() => {
    sessionStorage.setItem('jobDate', jobDate);
  }, [jobDate]);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="Pacific Bathroom" className="h-10 w-auto" />
          <input
            className="text-lg font-semibold bg-transparent border-b border-transparent focus:border-brand-600 focus:outline-none"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            aria-label="Project name"
          />
        </div>

        <div className="flex items-center gap-3 text-sm">
          <input
            className="rounded-md border px-3 py-1.5"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Contact name"
          />
          <input
            className="rounded-md border px-3 py-1.5"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Email"
          />
          <input
            className="rounded-md border px-3 py-1.5"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Phone"
          />
          <input
            type="date"
            className="rounded-md border px-3 py-1.5"
            value={jobDate}
            onChange={(e) => setJobDate(e.target.value)}
            aria-label="Date"
          />
        </div>
      </div>
    </header>
  );
}
