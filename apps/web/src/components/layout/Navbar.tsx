'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, BarChart2, Activity, ExternalLink } from 'lucide-react';
import { ThemeToggle } from '../theme/ThemeToggle';
import { Button } from '@/components/ui/button';
import { fetchSystemHealth, SystemHealthData } from '@/lib/api';

interface NavbarProps {
  onOpenAnalytics: () => void;
}

export function Navbar({ onOpenAnalytics }: NavbarProps) {
  const [health, setHealth] = useState<SystemHealthData | null>(null);

  useEffect(() => {
    fetchSystemHealth().then(setHealth);
    const interval = setInterval(() => {
      fetchSystemHealth().then(setHealth);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const isHealthy = health?.status === 'ok';

  return (
    <header className="sticky top-4 z-40 max-w-6xl mx-auto px-4 w-full">
      <nav className="glass-panel rounded-2xl px-5 py-3 flex items-center justify-between border border-slate-200/80 dark:border-white/10 shadow-glass-light dark:shadow-glass-dark">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-cyan-500 shadow-md shadow-blue-500/20 text-white">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-300 bg-clip-text text-transparent">
                Seekr
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none hidden sm:block">
              Intelligent Knowledge Search
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Engine Status Indicator */}
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 backdrop-blur"
            title={isHealthy ? 'Search library online' : 'Connecting to search engine...'}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isHealthy ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isHealthy ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="text-[11px]">
              {isHealthy ? 'Library Ready' : 'Connecting...'}
            </span>
          </div>

          {/* Insights Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenAnalytics}
            className="gap-1.5 text-xs font-medium"
          >
            <BarChart2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            <span className="hidden sm:inline">Search Insights</span>
          </Button>

          {/* Metrics Endpoint */}
          <a
            href="http://localhost:4000/metrics"
            target="_blank"
            rel="noopener noreferrer"
            title="Prometheus telemetry stream"
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/70 dark:hover:bg-white/10 transition"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Metrics</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>

          <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1" />

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
