'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, Layers, Sparkles, Binary } from 'lucide-react';
import { fetchSearchAnalytics, SearchAnalyticsData } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SearchAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchAnalyticsModal({ isOpen, onClose }: SearchAnalyticsModalProps) {
  const [analytics, setAnalytics] = useState<SearchAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchSearchAnalytics();
    setAnalytics(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const totalQueries = analytics?.totalQueries ?? 0;
  const avgLatency = analytics?.avgLatencyMs ?? 0;
  const p50Latency = analytics?.p50LatencyMs ?? 0;
  const p95Latency = analytics?.p95LatencyMs ?? 0;
  const searchCtr = analytics?.searchCtr ?? 0;
  const resultCtr = analytics?.resultCtr ?? 0;

  const getStats = (key: string) => {
    // 1. Check array format searchModeDistribution: [{ mode: 'HYBRID', count: 220, percentage: 64.14 }]
    if (analytics && Array.isArray((analytics as any).searchModeDistribution)) {
      const match = (analytics as any).searchModeDistribution.find(
        (m: any) => m?.mode?.toUpperCase() === key.toUpperCase()
      );
      if (match) {
        return {
          count: Number(match.count ?? 0),
          percentage: Number(match.percentage ?? 0),
        };
      }
    }

    // 2. Check object format modeDistribution: { HYBRID: 220 } or { HYBRID: { count: 220, percentage: ... } }
    if (!analytics?.modeDistribution) return { count: 0, percentage: 0 };
    const dist = analytics.modeDistribution as any;
    const raw = dist[key] ?? dist[key.toLowerCase()] ?? dist[key.toUpperCase()];
    if (typeof raw === 'number') {
      const pct = totalQueries > 0 ? (raw / totalQueries) * 100 : 0;
      return { count: raw, percentage: pct };
    }
    if (raw && typeof raw === 'object') {
      const count = Number(raw.count ?? 0);
      const percentage = Number(raw.percentage ?? (totalQueries > 0 ? (count / totalQueries) * 100 : 0));
      return { count, percentage };
    }
    return { count: 0, percentage: 0 };
  };

  const hybridStats = getStats('HYBRID');
  const semanticStats = getStats('SEMANTIC');
  const keywordStats = getStats('KEYWORD');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-slate-200/80 dark:border-white/10">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-xl">Search Insights</DialogTitle>
                <DialogDescription>
                  Real-time query performance, latency percentiles, and search engagement
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={loadData}
              disabled={loading}
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            </Button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        {!analytics ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Retrieving analytics...' : 'No search analytics available yet.'}
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Card 1: Total Queries */}
              <div className="p-4 rounded-2xl glass-panel border border-slate-200/70 dark:border-white/10 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Total Searches
                </span>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                  {(totalQueries ?? 0).toLocaleString()}
                </div>
              </div>

              {/* Card 2: Avg Latency */}
              <div className="p-4 rounded-2xl glass-panel border border-slate-200/70 dark:border-white/10 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Average Speed
                </span>
                <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                  {(avgLatency ?? 0).toFixed(1)}ms
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Typical: {(p50Latency ?? 0).toFixed(0)}ms · Max: {(p95Latency ?? 0).toFixed(0)}ms
                </div>
              </div>

              {/* Card 3: Search CTR */}
              <div className="p-4 rounded-2xl glass-panel border border-slate-200/70 dark:border-white/10 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Relevant Matches
                </span>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {Number(searchCtr > 1 ? searchCtr : (searchCtr ?? 0) * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400">Searches with clicks</div>
              </div>

              {/* Card 4: Result CTR */}
              <div className="p-4 rounded-2xl glass-panel border border-slate-200/70 dark:border-white/10 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Click-Through Rate
                </span>
                <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
                  {Number(resultCtr > 1 ? resultCtr : (resultCtr ?? 0) * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400">Result engagement</div>
              </div>
            </div>

            {/* Mode Distribution Section */}
            <div className="p-5 rounded-2xl glass-panel border border-slate-200/70 dark:border-white/10 space-y-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Search Mode Breakdown
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Smart Match</span>
                  </div>
                  <div className="text-lg font-bold font-mono">
                    {(hybridStats?.percentage ?? 0).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {hybridStats?.count ?? 0} queries
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>By Meaning</span>
                  </div>
                  <div className="text-lg font-bold font-mono">
                    {(semanticStats?.percentage ?? 0).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {semanticStats?.count ?? 0} queries
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Binary className="w-3.5 h-3.5" />
                    <span>Exact Words</span>
                  </div>
                  <div className="text-lg font-bold font-mono">
                    {(keywordStats?.percentage ?? 0).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {keywordStats?.count ?? 0} queries
                  </div>
                </div>
              </div>
            </div>

            {/* Top Queries & Top Clicked Documents */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Top Queries */}
              <div className="p-5 rounded-2xl glass-panel border border-slate-200/70 dark:border-white/10 space-y-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Top Searched Queries
                </span>
                <ul className="space-y-2">
                  {(analytics.topQueries || []).slice(0, 5).map((q, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-white/5 last:border-none"
                    >
                      <span className="truncate max-w-[200px] text-slate-700 dark:text-slate-300">
                        {q.query}
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500">
                        {q.count} searches
                      </span>
                    </li>
                  ))}
                  {(!analytics.topQueries || analytics.topQueries.length === 0) && (
                    <li className="text-xs text-slate-400">No query logs recorded yet.</li>
                  )}
                </ul>
              </div>

              {/* Top Clicked Documents */}
              <div className="p-5 rounded-2xl glass-panel border border-slate-200/70 dark:border-white/10 space-y-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Top Clicked Articles
                </span>
                <ul className="space-y-2">
                  {(analytics.topClickedDocuments || []).slice(0, 5).map((doc, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-white/5 last:border-none"
                    >
                      <span className="truncate max-w-[200px] text-slate-700 dark:text-slate-300">
                        {doc.title || doc.url}
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {doc.clicks} clicks
                      </span>
                    </li>
                  ))}
                  {(!analytics.topClickedDocuments || analytics.topClickedDocuments.length === 0) && (
                    <li className="text-xs text-slate-400">No document clicks recorded yet.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
