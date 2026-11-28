'use client';

import React from 'react';
import { SearchMode } from '@seekr/types';
import { Sparkles, Compass, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchModeSelectorProps {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
  className?: string;
}

export function SearchModeSelector({ mode, onChange, className }: SearchModeSelectorProps) {
  const modes: Array<{
    id: SearchMode;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    tag?: string;
  }> = [
    {
      id: 'HYBRID',
      label: 'Smart Match',
      description: 'Combines keywords and meaning for best results',
      icon: Sparkles,
      tag: 'Recommended',
    },
    {
      id: 'SEMANTIC',
      label: 'By Meaning',
      description: 'Finds ideas even if words are different',
      icon: Compass,
    },
    {
      id: 'KEYWORD',
      label: 'Exact Words',
      description: 'Matches specific phrases and terms',
      icon: Search,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Search filter options"
      className={cn(
        'inline-flex p-1.5 rounded-2xl glass-panel',
        'border border-slate-200/80 dark:border-white/10 shadow-glass-light dark:shadow-glass-dark',
        className
      )}
    >
      {modes.map((item) => {
        const Icon = item.icon;
        const isSelected = mode === item.id;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-medium transition-all duration-200',
              isSelected
                ? 'bg-white dark:bg-white/15 text-blue-600 dark:text-blue-300 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5'
            )}
            title={item.description}
          >
            <Icon className={cn('w-4 h-4', isSelected ? 'text-blue-600 dark:text-blue-400' : 'opacity-70')} />
            <div className="text-left flex items-center gap-1.5">
              <span>{item.label}</span>
              {item.tag && (
                <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20">
                  {item.tag}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
