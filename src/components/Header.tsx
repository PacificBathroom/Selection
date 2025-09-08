import React, { useEffect, useState } from 'react';
import logo from '../assets/logo.png';

function today() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function Header() {
  const [projectName, setProjectName] = useState('Pacific Bathroom Project');
  const [contactName, setContactName] = useState('Your Name');
  const [contactEmail, setContactEmail] = useState('you@example.com');
  const [contactPhone, setContactPhone] = useState('0000 000 000');
  const [jobDate, setJobDate] = useState(today());

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

  useEffect(() => {
    localStorage.setItem('projectName', projectName);
    localStorage.setItem('contactName', contactName);
    localStorage.setItem('contactEmail', contactEmail);
    localStorage.setItem('contactPhone', contactPhone);
    sessionStorage.setItem('jobDate', jobDate);
  }, [projectName, contactName, contactEmail, contactPhone, jobDate]);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Pacific Bathroom" className="h-12 w-auto" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            <input value={projectName} onChange={e=>setProjectName(e.target.value)} className="text-lg font-semibold border-b border-dashed bg-transparent focus:outline-none col-span-2"/>
            <input value={contactName} onChange={e=>setContactName(e.target.value)} className="text-xs text-slate-600 border-b border-dashed bg-transparent focus:outline-none"/>
            <input value={contactEmail} onChange={e=>setContactEmail(e.target.value)} className="text-xs text-slate-600 border-b border-dashed bg-transparent focus:outline-none"/>
            <input value={contactPhone} onChange={e=>setContactPhone(e.target.value)} className="text-xs text-slate-600 border-b border-dashed bg-transparent focus:outline-none"/>
            <input type="date" value={jobDate} onChange={e=>setJobDate(e.target.value)} className="text-xs text-slate-600 border-b border-dashed bg-transparent focus:outline-none"/>
          </div>
        </div>
        <div className="text-xs text-slate-500">Built with React + Tailwind</div>
      </div>
    </header>
  );
}
