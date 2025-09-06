import React, { useEffect, useState } from 'react';
import logo from '../assets/logo.png';

function getTodayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function Header() {
  const [projectName, setProjectName] = useState<string>('Pacific Bathroom Project');
  const [contactName, setContactName] = useState<string>('Your Name');
  const [contactEmail, setContactEmail] = useState<string>('you@example.com');
  const [contactPhone, setContactPhone] = useState<string>('0000 000 000');
  const [jobDate, setJobDate] = useState<string>(getTodayISO());

  useEffect(() => {
    const pn = localStorage.getItem('projectName');
    const cn = localStorage.getItem('contactName');
    const ce = localStorage.getItem('contactEmail');
    const cp = localStorage.getItem('contactPhone');
    const jd = sessionStorage.getItem('jobDate');
    if (pn) setProjectName(pn);
    if (cn) setContactName(cn);
    if (ce) setContactEmail(ce);
    if (cp) setContactPhone(cp);
    if (jd) setJobDate(jd);
  }, []);

  useEffect(() => { localStorage.setItem('projectName', projectName); }, [projectName]);
  useEffect(() => { localStorage.setItem('contactName', contactName); }, [contactName]);
  useEffect(() => { localStorage.setItem('contactEmail', contactEmail); }, [contactEmail]);
  useEffect(() => { localStorage.setItem('contactPhone', contactPhone); }, [contactPhone]);

  useEffect(() => { sessionStorage.setItem('jobDate', jobDate); }, [jobDate]);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Pacific Bathroom" className="h-12 w-auto" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            <input value={projectName} onChange={e => setProjectName(e.target.value)} className="text-lg font-semibold leading-tight border-b border-dashed focus:outline-none bg-transparent col-span-2" aria-label="Project name" />
            <input value={contactName} onChange={e => setContactName(e.target.value)} className="text-xs text-slate-600 border-b border-dashed focus:outline-none bg-transparent" aria-label="Contact name" />
            <input value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="text-xs text-slate-600 border-b border-dashed focus:outline-none bg-transparent" aria-label="Contact email" />
            <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="text-xs text-slate-600 border-b border-dashed focus:outline-none bg-transparent" aria-label="Contact phone" />
            <input type="date" value={jobDate} onChange={e => setJobDate(e.target.value)} className="text-xs text-slate-600 border-b border-dashed focus:outline-none bg-transparent" aria-label="Date" />
          </div>
        </div>
        <div className="text-xs text-slate-500">Built with React + Tailwind</div>
      </div>
    </header>
  );
}
