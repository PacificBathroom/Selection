import React from "react";

export default function Header() {
  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div /> {/* spacer to visually center the logo if needed */}
        <img
          src="/logo.png"             // <- ensure this path matches your repo
          alt="Pacific Bathroom"
          className="h-8 w-auto"
        />
        <div /> {/* spacer */}
      </div>
    </header>
  );
}
