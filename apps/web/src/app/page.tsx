'use client';

import React, { useState } from 'react';
import { SearchMode } from '@seekr/types';
import { Navbar } from '@/components/layout/Navbar';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { SearchBox } from '@/components/search/SearchBox';
import { SearchResults } from '@/components/search/SearchResults';
import { SearchAnalyticsModal } from '@/components/search/SearchAnalyticsModal';
import { executeSearch, executeSearchProgressive, SearchResponseData } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, ShieldCheck, Sparkles, Zap, ArrowUpRight } from 'lucide-react';

export default function HomePage() {
  const [searchData, setSearchData] = useState<SearchResponseData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  const [activeQuery, setActiveQuery] = useState('');
  const [activeMode, setActiveMode] = useState<SearchMode>('HYBRID');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string | null>(null);
  const [isAiResponseEnabled, setIsAiResponseEnabled] = useState(false);
  const [progressivePhase, setProgressivePhase] = useState<{ phase: string; message: string } | null>(null);

  const handleSearch = (query: string, mode: SearchMode, page = 1) => {
    setIsLoading(true);
    setError(null);
    setActiveQuery(query);
    setActiveMode(mode);
    setProgressivePhase(null);
    if (page === 1) {
      setSelectedSourceFilter(null);
    }

    executeSearchProgressive(
      { q: query, mode, page, limit: 10 },
      {
        onPhase: (phase, message) => {
          setProgressivePhase({ phase, message });
        },
        onLocalResults: (data) => {
          setSearchData(data);
          setIsLoading(false);
        },
        onComplete: (data) => {
          setSearchData(data);
          setIsLoading(false);
          setProgressivePhase(null);
          if (page > 1 && typeof window !== 'undefined') {
            window.scrollTo({ top: 280, behavior: 'smooth' });
          }
        },
        onError: (err: any) => {
          console.error('[HomePage] Search execution failed:', err);
          setError(err?.message || 'Search failed. Please ensure the search service is running.');
          setIsLoading(false);
          setProgressivePhase(null);
        },
      }
    );
  };

  const curatedTopics = [
    {
      title: 'Data Storage & Recovery',
      description: 'How modern memory stores save snapshots and recover after unexpected crashes.',
      query: 'How does Redis persistence and snapshotting work?',
      icon: Database,
      tag: 'Database',
      accent: 'text-blue-500',
    },
    {
      title: 'Web Security & Protection',
      description: 'Preventing private network leaks and SSRF vulnerabilities in automated crawlers.',
      query: 'What protects web crawlers against SSRF vulnerabilities?',
      icon: ShieldCheck,
      tag: 'Security',
      accent: 'text-emerald-500',
    },
    {
      title: 'Concept & Semantic Search',
      description: 'Finding relevant knowledge by meaning and context even when words differ.',
      query: 'How does vector similarity search find related concepts?',
      icon: Sparkles,
      tag: 'Discovery',
      accent: 'text-purple-500',
    },
    {
      title: 'High-Speed Caching',
      description: 'Accelerating repeated queries and eliminating rate limits with tiered memory.',
      query: 'How does tiered caching speed up retrieval?',
      icon: Zap,
      tag: 'Performance',
      accent: 'text-amber-500',
    },
  ];

  return (
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Dynamic Glassmorphism Ambient Glow Backdrop */}
      <AmbientBackground />

      {/* Main Top Navigation */}
      <Navbar onOpenAnalytics={() => setIsAnalyticsOpen(true)} />

      {/* Hero & Search Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col items-center">
        {/* Hero Branding Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full glass-panel text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
            <span>Intelligent Knowledge Search</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Find answers in your{' '}
            <span className="glass-text-shimmer">library</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
            Ask questions naturally or search exact terms to discover verified guides, technical
            articles, and documentation instantly.
          </p>
        </div>

        {/* Omnibox Search Component with Gemini Typewriter */}
        <SearchBox
          onSearch={(q, m) => handleSearch(q, m, 1)}
          isLoading={isLoading}
          initialQuery={activeQuery}
          initialMode={activeMode}
        />

        {/* Error Alert Display */}
        {error && (
          <div className="w-full max-w-3xl mt-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs underline font-semibold hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Search Results Display with Top & Bottom Pagination and Sidebar Filters */}
        <SearchResults
          data={searchData}
          isLoading={isLoading}
          onPageChange={(page) => handleSearch(activeQuery, activeMode, page)}
          selectedSourceFilter={selectedSourceFilter}
          onSelectSourceFilter={setSelectedSourceFilter}
          isAiResponseEnabled={isAiResponseEnabled}
          onToggleAiResponse={setIsAiResponseEnabled}
          progressivePhase={progressivePhase}
        />

        {/* Curated Exploration Cards when no active search (Proper Space Utilization) */}
        {!searchData && !isLoading && (
          <section className="w-full max-w-5xl mt-16 pt-8 border-t border-slate-200/60 dark:border-white/5 space-y-6 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Explore Topics in Library
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click any topic to search its verified documentation and articles
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {curatedTopics.map((topic, index) => {
                const Icon = topic.icon;
                return (
                  <Card
                    key={index}
                    onClick={() => handleSearch(topic.query, 'HYBRID', 1)}
                    className="p-5 glass-panel-interactive cursor-pointer group flex flex-col justify-between space-y-3 transition-all hover:scale-[1.02]"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-xl bg-slate-100 dark:bg-white/5 ${topic.accent}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {topic.tag}
                        </Badge>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {topic.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {topic.description}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      <span>Search topic</span>
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/80 dark:border-white/5 py-6 px-4 mt-12 text-center text-xs text-slate-500 dark:text-slate-400 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            © {new Date().getFullYear()} Seekr — Knowledge & Research Engine.
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Fast search</span>
            <span>•</span>
            <span>Verified sources</span>
            <span>•</span>
            <span>Telemetry ready</span>
          </div>
        </div>
      </footer>

      {/* Engine Analytics Modal */}
      <SearchAnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
      />
    </div>
  );
}
