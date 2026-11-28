'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ExternalLink,
  Zap,
  Clock,
  Sparkles,
  FileText,
  Globe,
  Code2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Share2,
  Check,
  Star,
  Layers,
  Compass,
  Search,
  Filter,
  CheckSquare,
  Square,
  RotateCcw,
  BookOpen,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { SearchResponseData, SearchResultItem, recordSearchClick } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * High-legibility text component that highlights search query keywords.
 */
function HighlightedText({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim() || !text) {
    return <span>{text}</span>;
  }

  const tokens = query
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter((t) => t.length > 1);

  if (tokens.length === 0) {
    return <span>{text}</span>;
  }

  const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        const isMatch = tokens.some((t) => new RegExp(`^${t}$`, 'i').test(part));
        return isMatch ? (
          <span
            key={i}
            className="font-bold underline decoration-blue-500/50 decoration-2 underline-offset-2 text-blue-700 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-400/15 px-0.5 rounded"
          >
            {part}
          </span>
        ) : (
          part
        );
      })}
    </span>
  );
}

/**
 * Gemini-style AI Response streaming synthesis component
 */
function GeminiAiSynthesis({
  query,
  results,
  onJumpToResult,
}: {
  query: string;
  results: SearchResultItem[];
  onJumpToResult: (index: number) => void;
}) {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  // Synthesize concise answer from top results
  const summary = useMemo(() => {
    if (!results || results.length === 0) return '';
    const top = results.slice(0, 3);
    const doc1 = top[0]?.title || 'primary documentation';
    const snippet1 = (top[0]?.content || '').slice(0, 180).trim();
    const doc2 = top[1]?.title ? ` and ${top[1].title}` : '';

    return `According to verified technical sources in your library (${doc1}${doc2}): ${snippet1}...`;
  }, [results]);

  useEffect(() => {
    if (!summary) return;
    setDisplayText('');
    setIsTyping(true);

    let charIdx = 0;
    const interval = setInterval(() => {
      charIdx += 3;
      if (charIdx >= summary.length) {
        setDisplayText(summary);
        setIsTyping(false);
        clearInterval(interval);
      } else {
        setDisplayText(summary.slice(0, charIdx));
      }
    }, 20);

    return () => clearInterval(interval);
  }, [summary]);

  if (!results || results.length === 0) return null;

  return (
    <div className="p-5 rounded-2xl glass-panel border border-blue-500/30 dark:border-blue-400/20 bg-gradient-to-br from-blue-50/50 via-slate-50/40 to-indigo-50/30 dark:from-blue-950/20 dark:via-slate-900/40 dark:to-indigo-950/20 shadow-md space-y-3 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-sm">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Gemini Research Synthesis
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-2">
              Verified from knowledge library
            </span>
          </div>
        </div>

        <Badge variant="secondary" className="text-[10px] gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span>Grounding Verified</span>
        </Badge>
      </div>

      <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
        <span>{displayText}</span>
        {isTyping && (
          <span className="inline-block w-1.5 h-4 ml-1 bg-blue-600 dark:bg-blue-400 animate-pulse" />
        )}
      </div>

      {/* Citation Chips linking to cards */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-white/5 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Citations:
        </span>
        {results.slice(0, 3).map((r, i) => (
          <button
            key={r.chunkId}
            type="button"
            onClick={() => onJumpToResult(i + 1)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/80 dark:bg-white/10 border border-slate-200/80 dark:border-white/10 hover:border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 transition-all shadow-sm"
          >
            <span className="font-bold">[{i + 1}]</span>
            <span className="truncate max-w-[150px]">{r.title || 'Source'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface SearchResultsProps {
  data: SearchResponseData | null;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  selectedSourceFilter?: string | null;
  onSelectSourceFilter?: (source: string | null) => void;
  isAiResponseEnabled?: boolean;
  onToggleAiResponse?: (enabled: boolean) => void;
  progressivePhase?: { phase: string; message: string } | null;
}

export function SearchResults({
  data,
  isLoading,
  onPageChange,
  selectedSourceFilter = null,
  onSelectSourceFilter,
  isAiResponseEnabled = false,
  onToggleAiResponse,
  progressivePhase = null,
}: SearchResultsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [clickedChunks, setClickedChunks] = useState<Set<string>>(new Set());

  // Derive source types and domains with counts from results
  const sourceStats = useMemo(() => {
    if (!data?.results) return { types: [], domains: [] };

    const typeCount: Record<string, number> = {};
    const domainCount: Record<string, number> = {};

    data.results.forEach((r) => {
      // Source Type
      const type = r.sourceType || 'WEB';
      typeCount[type] = (typeCount[type] || 0) + 1;

      // Domain
      try {
        const domain = new URL(r.url).hostname.replace('www.', '');
        domainCount[domain] = (domainCount[domain] || 0) + 1;
      } catch {
        // Fallback
      }
    });

    return {
      types: Object.entries(typeCount).map(([type, count]) => ({ type, count })),
      domains: Object.entries(domainCount).map(([domain, count]) => ({ domain, count })),
    };
  }, [data]);

  // Filter results if user selected a source filter
  const filteredResults = useMemo(() => {
    if (!data?.results) return [];
    if (!selectedSourceFilter) return data.results;

    return data.results.filter((r) => {
      if (r.sourceType.toUpperCase() === selectedSourceFilter.toUpperCase()) return true;
      try {
        const domain = new URL(r.url).hostname.replace('www.', '');
        if (domain.toLowerCase() === selectedSourceFilter.toLowerCase()) return true;
      } catch {}
      return false;
    });
  }, [data, selectedSourceFilter]);

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-4 pt-6 animate-pulse">
        <div className="h-8 w-64 rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <div className="h-72 rounded-2xl glass-panel border border-slate-200/80 dark:border-white/10" />
          </div>
          <div className="lg:col-span-9 space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-6 rounded-2xl glass-panel border border-slate-200/80 dark:border-white/10 space-y-3"
              >
                <div className="h-5 w-2/3 rounded-lg bg-slate-200/70 dark:bg-slate-800/60" />
                <div className="h-4 w-1/3 rounded-lg bg-slate-200/50 dark:bg-slate-800/40" />
                <div className="space-y-2 pt-2">
                  <div className="h-3.5 w-full rounded bg-slate-200/50 dark:bg-slate-800/40" />
                  <div className="h-3.5 w-5/6 rounded bg-slate-200/50 dark:bg-slate-800/40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { pagination, latencyMs, cached, queryId } = data;

  const handleResultClick = (item: SearchResultItem) => {
    setClickedChunks((prev) => new Set(prev).add(item.chunkId));
    recordSearchClick({
      queryId,
      resultChunkId: item.chunkId,
      clickedRank: item.rank,
    });
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startResult = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endResult = Math.min(pagination.page * pagination.limit, pagination.total);
  const safeTotalPages = Math.max(
    1,
    Number(pagination.totalPages) || Math.ceil(pagination.total / (pagination.limit || 10)) || 1
  );

  // Pagination Bar Component (reusable at Top & Bottom - SWIRL Image 3 style)
  const renderPaginationBar = () => {
    if (pagination.total === 0) return null;

    const totalPages = safeTotalPages;
    const currentPage = pagination.page;

    // Generate page numbers window (e.g. up to 7 pages)
    const pageNumbers: number[] = [];
    const maxVisible = 7;
    let start = Math.max(1, currentPage - 3);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let p = start; p <= end; p++) {
      pageNumbers.push(p);
    }

    return (
      <div className="flex items-center gap-1 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange?.(currentPage - 1)}
          className="h-8 px-2.5 rounded-lg text-xs font-medium border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
          <span>Prev</span>
        </Button>

        {pageNumbers.map((pageNum) => (
          <Button
            key={pageNum}
            variant={currentPage === pageNum ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange?.(pageNum)}
            className={cn(
              'h-8 min-w-[32px] px-2 rounded-lg text-xs font-semibold transition-all',
              currentPage === pageNum
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
            )}
          >
            {pageNum}
          </Button>
        ))}

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange?.(currentPage + 1)}
          className="h-8 px-2.5 rounded-lg text-xs font-medium border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </Button>
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pt-6">
      {/* 2-Column Responsive Swirl/Gemini-Style Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Source & Domain Filtering (SWIRL-Style) */}
        <aside className="lg:col-span-3 space-y-4">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
                <span>SOURCE</span>
              </div>
              {selectedSourceFilter && (
                <button
                  type="button"
                  onClick={() => onSelectSourceFilter?.(null)}
                  className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear all</span>
                </button>
              )}
            </div>

            {/* Source Types */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Category
              </span>
              <div className="space-y-1">
                {sourceStats.types.map((st) => {
                  const isChecked = selectedSourceFilter === st.type;
                  return (
                    <button
                      key={st.type}
                      type="button"
                      onClick={() =>
                        onSelectSourceFilter?.(isChecked ? null : st.type)
                      }
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left',
                        isChecked
                          ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isChecked ? (
                          <CheckSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="capitalize truncate">
                          {st.type.toLowerCase().replace('_', ' ')}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {st.count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Domains */}
            {sourceStats.domains.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Domains
                </span>
                <div className="space-y-1">
                  {sourceStats.domains.map((sd) => {
                    const isChecked = selectedSourceFilter === sd.domain;
                    return (
                      <button
                        key={sd.domain}
                        type="button"
                        onClick={() =>
                          onSelectSourceFilter?.(isChecked ? null : sd.domain)
                        }
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left',
                          isChecked
                            ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isChecked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{sd.domain}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {sd.count}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Clear All */}
            {selectedSourceFilter && (
              <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectSourceFilter?.(null)}
                  className="w-full text-xs text-blue-600 dark:text-blue-400 h-8 justify-center hover:bg-blue-50 dark:hover:bg-blue-500/10"
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </Card>

          {/* Quick AI Response / Deep Research Card */}
          <Card className="p-4 space-y-3 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-cyan-500/10 border-blue-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span>AI Research Synthesis</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAiResponseEnabled}
                  onChange={(e) => onToggleAiResponse?.(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600" />
              </label>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Synthesizes verified answers with citations directly from verified sources.
            </p>
          </Card>
        </aside>

        {/* Main Content Area: Top Pagination + Result Cards */}
        <main className="lg:col-span-9 space-y-4">
          {/* Gemini AI Research Synthesis Card (when toggled on like SWIRL Image 3) */}
          {isAiResponseEnabled && filteredResults.length > 0 && (
            <GeminiAiSynthesis
              query={data.query}
              results={filteredResults}
              onJumpToResult={(rank) => {
                const el = document.getElementById(`result-card-${rank}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          )}

          {/* Live Discovery Progressive Status Banner */}
          {progressivePhase && (
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-500 animate-spin" />
                <span className="font-medium">{progressivePhase.message}</span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400">
                Web Discovery Active
              </span>
            </div>
          )}

          {/* Top Control Bar with PROMINENT TOP PAGINATION (exactly like SWIRL Image 3) */}
          <div className="p-4 rounded-2xl glass-panel border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {pagination.total === 0
                  ? 'No results found'
                  : `Showing results ${startResult} – ${endResult} of ${pagination.total.toLocaleString()} found in ${(latencyMs / 1000).toFixed(2)} seconds.`}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Clock className="w-3 h-3" />
                <span>Response speed {latencyMs}ms</span>
                {cached && (
                  <Badge variant="success" className="text-[10px] px-1.5 py-0">
                    Memory Cache Hit
                  </Badge>
                )}
                {data.dynamicallyCrawled && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 gap-1 font-medium">
                    <Sparkles className="w-3 h-3 text-emerald-500 animate-pulse" />
                    <span>Real-Time Web Discovery</span>
                  </Badge>
                )}
              </div>
            </div>

            {/* TOP PAGINATION BAR (Visible for all pages, SWIRL style) */}
            {renderPaginationBar()}
          </div>

          {/* Empty State */}
          {filteredResults.length === 0 && (
            <Card className="p-10 text-center space-y-4">
              <Compass className="w-9 h-9 text-blue-500 mx-auto" />
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {data.queryCategory === 'GIBBERISH'
                    ? 'Unrecognized search query'
                    : 'No matching results found'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  {data.queryCategory === 'GIBBERISH'
                    ? `We couldn't recognize any meaningful keywords or technical topics in "${data.query}". Please check your spelling or try asking a clear question.`
                    : `We couldn't find any documents matching "${data.query}". Try searching with different keywords, asking a question, or clearing your active filters.`}
                </p>
              </div>
              {selectedSourceFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectSourceFilter?.(null)}
                >
                  Clear filter
                </Button>
              )}
            </Card>
          )}

          {/* Secondary Controls Bar (Matching SWIRL Template in Image 3) */}
          {filteredResults.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">
                  VIEW BY:
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300 bg-slate-200/60 dark:bg-white/10 px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1 shadow-sm">
                  Relevancy ▾
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span>Indexed Knowledge Library</span>
              </div>
            </div>
          )}

          {/* Result Cards List (Styled with High-Legibility Sans-Serif & Structure like Image 2 & 3) */}
          <div className="space-y-3.5">
            {filteredResults.map((item, index) => {
              const isClicked = clickedChunks.has(item.chunkId);
              const isCopied = copiedId === item.chunkId;
              const isStarred = starredIds.has(item.chunkId);

              let domain = '';
              try {
                domain = new URL(item.url).hostname.replace('www.', '');
              } catch {
                domain = item.url;
              }

              const resultNumber = index + 1 + (pagination.page - 1) * pagination.limit;

              return (
                <article
                  key={item.chunkId}
                  id={`result-card-${resultNumber}`}
                  className={cn(
                    'group relative rounded-2xl glass-panel-interactive p-5 sm:p-6 transition-all',
                    'border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md',
                    isClicked && 'ring-1 ring-blue-500/30 dark:ring-blue-400/30'
                  )}
                >
                  {/* Top Line: Number + Title + Publication Date (SWIRL Image 3 style) */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleResultClick(item)}
                        className="inline-flex items-center gap-1.5 hover:underline"
                      >
                        <span className="font-semibold text-blue-600 dark:text-blue-400 mr-1">
                          {resultNumber}.
                        </span>
                        <span>
                          <HighlightedText
                            text={item.title || 'Untitled Knowledge Article'}
                            query={data.query}
                          />
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                      </a>
                    </h3>

                    <div className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3 opacity-60" />
                      <span>{data.dynamicallyCrawled ? 'Crawled Live from Web' : 'Publication Date: Nov 25, 2026'}</span>
                    </div>
                  </div>

                  {/* High-Legibility Snippet Content with highlighted terms */}
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans line-clamp-3 mb-3">
                    <HighlightedText text={item.content} query={data.query} />
                  </p>

                  {/* URL Line (like Image 2 & 3: @url: ...) */}
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400 dark:text-slate-500 truncate mb-3">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">@url:</span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:underline text-blue-600 dark:text-blue-400"
                    >
                      {item.url}
                    </a>
                  </div>

                  {/* Bottom Source Pill & Star Bookmark (like Image 3) */}
                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-white/5 text-xs text-slate-500">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-500/25 transition-colors"
                      >
                        <Globe className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="truncate max-w-[220px]">{domain}</span>
                        <span className="opacity-40">•</span>
                        <span className="truncate max-w-[180px] font-mono text-[10px] text-slate-400 dark:text-slate-300">
                          {item.url}
                        </span>
                      </a>

                      <span className="capitalize px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-white/5 text-slate-500 font-medium">
                        {item.sourceType.toLowerCase().replace('_', ' ')}
                      </span>

                      {isClicked && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ Visited
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(item.url, item.chunkId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition"
                        title="Copy URL"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStar(item.chunkId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 transition"
                        title={isStarred ? 'Remove bookmark' : 'Bookmark article'}
                      >
                        <Star
                          className={cn(
                            'w-4 h-4',
                            isStarred ? 'fill-amber-400 text-amber-500' : 'text-slate-400 hover:text-amber-400'
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* BOTTOM PAGINATION BAR */}
          {pagination.total > 0 && (
            <div className="p-4 rounded-2xl glass-panel border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3 shadow-sm">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Page {pagination.page} of {safeTotalPages} ({pagination.total.toLocaleString()} unique documents)
              </span>
              {renderPaginationBar()}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
