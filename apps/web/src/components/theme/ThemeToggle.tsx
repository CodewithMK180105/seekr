'use client';

import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme, Theme } from './ThemeProvider';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const options: Array<{ value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Laptop },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Color scheme selection"
      className={cn(
        'inline-flex items-center p-1 rounded-xl glass-panel',
        'border border-slate-200/80 dark:border-white/10 shadow-sm backdrop-blur-md',
        className
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isSelected = theme === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${opt.label} mode`}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'relative flex items-center justify-center p-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              isSelected
                ? 'bg-white text-blue-600 shadow-sm dark:bg-white/15 dark:text-blue-400 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'
            )}
            title={`${opt.label} mode (current: ${resolvedTheme})`}
          >
            <Icon className="w-4 h-4" />
            <span className="sr-only">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
