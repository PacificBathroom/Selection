// src/components/Header.tsx
import React from 'react';

export default function Header() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Pacific Bathroom"
            className="h-8 w-auto"
            onError={(e) => {
              // Hide if missing; avoids broken image icon
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="text-sm text-slate-500 hidden sm:block">
            Built with React + Tailwind
          </div>
        </div>
        <div className="text-xs text-slate-400">
          Pacific Bathroom Selection
        </div>
      </div>
    </header>
  );
}
