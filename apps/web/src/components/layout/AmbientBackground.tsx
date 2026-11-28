'use client';

import React from 'react';

export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      {/* Background canvas gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-slate-100/70 to-slate-200/50 dark:from-[#050814] dark:via-[#090e1f] dark:to-[#04060d] transition-colors duration-500" />

      {/* Subtle modern dot matrix pattern */}
      <div
        className="absolute inset-0 opacity-[0.4] dark:opacity-[0.18]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Radiant Glowing Orbs behind the glass */}
      {/* Orb 1: Primary Blue / Indigo (Top Left) */}
      <div className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full blur-[130px] opacity-70 dark:opacity-40 bg-gradient-to-br from-blue-400 via-indigo-400 to-transparent dark:from-blue-600 dark:via-indigo-600 animate-pulse-slow" />

      {/* Orb 2: Violet / Rose (Top Right) */}
      <div className="absolute -top-[10%] -right-[10%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full blur-[140px] opacity-60 dark:opacity-30 bg-gradient-to-bl from-purple-300 via-pink-300 to-transparent dark:from-purple-600 dark:via-fuchsia-700 animate-float-slow" />

      {/* Orb 3: Cyan / Emerald (Bottom Center) */}
      <div className="absolute bottom-[5%] left-[20%] w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full blur-[150px] opacity-50 dark:opacity-25 bg-gradient-to-tr from-cyan-300 via-teal-200 to-transparent dark:from-cyan-500 dark:via-emerald-600" />
    </div>
  );
}
