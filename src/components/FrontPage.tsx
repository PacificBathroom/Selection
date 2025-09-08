import React, { useEffect } from 'react';
import type { ClientInfo } from '../types';

type Props = { client: ClientInfo; setClient: (c: ClientInfo) => void };

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function FrontPage({ client, setClient }: Props) {
  useEffect(() => {
    const saved = localStorage.getItem('clientInfo');
    if (saved) setClient(JSON.parse(saved));
  }, [setClient]);

  useEffect(() => {
    localStorage.setItem('clientInfo', JSON.stringify(client));
  }, [client]);

  return (
    <div id="slide-front" className="bg-white rounded-2xl border shadow-card p-6">
      <div className="flex items-center justify-between border rounded-xl p-5 bg-slate-50">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Pacific Bathroom" className="h-14 w-auto" />
          <div className="leading-tight">
            <input
              value={client.projectName ?? 'Project Selection'}
              onChange={e => setClient({ ...client, projectName: e.target.value })}
              className="text-2xl font-semibold border-b border-dashed bg-transparent focus:outline-none"
              aria-label="Project name"
            />
            <div className="text-slate-600 text-sm mt-1">
              <span>Prepared for </span>
              <input
                value={client.clientName}
                onChange={e => setClient({ ...client, clientName: e.target.value })}
                placeholder="Client name"
                className="border-b border-dashed bg-transparent focus:outline-none"
                aria-label="Client name"
              />
            </div>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="text-slate-600">Date</div>
          <input
            type="date"
            value={client.dateISO || todayISO()}
            onChange={e => setClient({ ...client, dateISO: e.target.value })}
            className="border-b border-dashed bg-transparent focus:outline-none"
            aria-label="Date"
          />
        </div>
      </div>
    </div>
  );
}
