import React from 'react';
import type { ClientInfo } from '../types';

type Props = {
  client: ClientInfo;
  setClient: (next: ClientInfo) => void;
  sectionsCount?: number;
};

export default function Header({ client, setClient, sectionsCount = 0 }: Props) {
  const on = (k: keyof ClientInfo) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setClient({ ...client, [k]: e.target.value });

  return (
    <header className="bg-white border-b">
      <div className="mx-auto max-w-7xl px-4 py-3">
        {/* Top row: logo + title + date */}
        <div className="flex items-center gap-4">
          <img
            src="/logo.png"
            alt="Pacific Bathroom"
            className="h-10 w-auto"
          />

          <div className="flex-1">
            <div className="text-xl font-semibold leading-tight">
              {client.projectName || 'Project Selection'}
            </div>
            <div className="text-xs text-slate-500">
              {sectionsCount} {sectionsCount === 1 ? 'section' : 'sections'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="proj-date" className="text-xs text-slate-600">
              Date
            </label>
            <input
              id="proj-date"
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={client.dateISO || ''}
              onChange={on('dateISO')}
            />
          </div>
        </div>

        {/* Contact + project fields */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            className="border rounded px-3 py-2 text-sm"
            placeholder="Project name"
            aria-label="Project name"
            value={client.projectName}
            onChange={on('projectName')}
          />
          <input
            type="text"
            className="border rounded px-3 py-2 text-sm"
            placeholder="Client name"
            aria-label="Client name"
            value={client.clientName}
            onChange={on('clientName')}
          />
          <input
            type="text"
            className="border rounded px-3 py-2 text-sm"
            placeholder="Contact name"
            aria-label="Contact name"
            value={client.contactName || ''}
            onChange={on('contactName')}
          />
          <input
            type="email"
            className="border rounded px-3 py-2 text-sm"
            placeholder="Email"
            aria-label="Contact email"
            value={client.contactEmail || ''}
            onChange={on('contactEmail')}
          />
          <input
            type="tel"
            className="border rounded px-3 py-2 text-sm"
            placeholder="Phone"
            aria-label="Contact phone"
            value={client.contactPhone || ''}
            onChange={on('contactPhone')}
          />
        </div>
      </div>
    </header>
  );
}