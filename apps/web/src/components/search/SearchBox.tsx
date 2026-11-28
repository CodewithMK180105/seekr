'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, History, BookOpen, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';
import { SearchMode } from '@seekr/types';
import { fetchSuggestions, SuggestionItem } from '@/lib/api';
import { SearchModeSelector } from './SearchModeSelector';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SearchBoxProps {
  onSearch: (query: string, mode: SearchMode) => void;
  isLoading?: boolean;
  initialQuery?: string;
  initialMode?: SearchMode;
}

const SAMPLE_PROMPTS = [
  'How does Redis save and recover data?',
  'What protects web crawlers against security risks?',
  'Explain similarity search and concept matching',
  'How does hybrid ranking find the best articles?',
  'Find setup guides for background indexing',
];

export function SearchBox({
  onSearch,
  isLoading = false,
  initialQuery = '',
  initialMode = 'HYBRID',
}: SearchBoxProps) {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [isFocused, setIsFocused] = useState(false);

  // Gemini-style animated typewriter placeholder
  const [placeholderText, setPlaceholderText] = useState('');
  const [promptIndex, setPromptIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync state if initialQuery changes
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Typewriter effect loop when input is empty
  useEffect(() => {
    if (query || isFocused) return;

    const currentPrompt = SAMPLE_PROMPTS[promptIndex % SAMPLE_PROMPTS.length];
    let timeout: NodeJS.Timeout;

    if (!isDeleting && charIndex <= currentPrompt.length) {
      setPlaceholderText(currentPrompt.slice(0, charIndex));
      if (charIndex === currentPrompt.length) {
        timeout = setTimeout(() => setIsDeleting(true), 2400);
      } else {
        timeout = setTimeout(() => setCharIndex((c) => c + 1), 45);
      }
    } else if (isDeleting && charIndex >= 0) {
      setPlaceholderText(currentPrompt.slice(0, charIndex));
      if (charIndex === 0) {
        setIsDeleting(false);
        setPromptIndex((p) => p + 1);
        timeout = setTimeout(() => setCharIndex(1), 300);
      } else {
        timeout = setTimeout(() => setCharIndex((c) => c - 1), 25);
      }
    }

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, promptIndex, query, isFocused]);

  // Debounced suggestion fetching
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await fetchSuggestions(query, 6);
        setSuggestions(results);
        setShowSuggestions(results.length > 0 && isFocused);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, isFocused]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut listener (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent, customQuery?: string) => {
      if (e) e.preventDefault();
      const q = (customQuery !== undefined ? customQuery : query).trim();
      if (!q) return;

      setShowSuggestions(false);
      inputRef.current?.blur();
      onSearch(q, mode);
    },
    [query, mode, onSearch]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSubmit();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        const selected = suggestions[activeIndex].text;
        setQuery(selected);
        handleSubmit(undefined, selected);
      } else {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const popularTopics = [
    'Redis persistence and data recovery',
    'SSRF crawler security protection',
    'Vector similarity search',
    'Background indexing queue',
  ];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4" ref={containerRef}>
      {/* Mode Filter Selector */}
      <div className="flex justify-center">
        <SearchModeSelector mode={mode} onChange={setMode} />
      </div>

      {/* Omnibox Container */}
      <div className="relative">
        <form onSubmit={handleSubmit} className="relative">
          <div
            className={cn(
              'relative flex items-center w-full rounded-2xl glass-input transition-all duration-300',
              'border border-slate-200/90 dark:border-white/10 shadow-glass-light dark:shadow-glass-dark',
              isFocused &&
                'border-blue-500/60 dark:border-blue-400/50 shadow-glow-blue ring-4 ring-blue-500/10 dark:ring-blue-400/10'
            )}
          >
            {/* Search / Gemini Glow Icon */}
            <div className="pl-5 pr-1 text-slate-400 dark:text-slate-500 flex items-center justify-center">
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              ) : (
                <div className="relative">
                  <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
                </div>
              )}
            </div>

            {/* Input with Typewriter Placeholder */}
            <div className="relative w-full">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  setIsFocused(true);
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => {
                  if (!query) {
                    setIsFocused(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder=""
                className="relative z-10 w-full py-4 pl-3.5 pr-32 bg-transparent text-slate-900 dark:text-slate-100 text-base sm:text-lg focus:outline-none"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck="false"
              />

              {/* Gemini Typewriter Animated Placeholder */}
              {!query && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center pl-3.5 text-base sm:text-lg text-slate-400 dark:text-slate-500 truncate"
                >
                  <span>{placeholderText}</span>
                  <span className="inline-block w-[2px] h-5 ml-0.5 bg-blue-500/80 animate-pulse" />
                </div>
              )}
            </div>

            {/* Clear and Submit Actions */}
            <div className="absolute right-2.5 flex items-center gap-1.5 z-20">
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition"
                  title="Clear (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !query.trim()}
                className="hidden sm:inline-flex gap-1.5 shadow-sm"
              >
                <span>Search</span>
                <CornerDownLeft className="w-3.5 h-3.5 opacity-75" />
              </Button>

              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !query.trim()}
                className="sm:hidden w-8 h-8 rounded-lg"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </form>

        {/* Live Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl glass-panel border border-slate-200/90 dark:border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="p-2">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Matching Suggestions
              </div>
              <ul role="listbox" className="space-y-0.5">
                {suggestions.map((item, idx) => {
                  const isItemActive = idx === activeIndex;
                  const isTitle = item.source === 'title';

                  return (
                    <li
                      key={`${item.text}-${idx}`}
                      role="option"
                      aria-selected={isItemActive}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        setQuery(item.text);
                        handleSubmit(undefined, item.text);
                      }}
                      className={cn(
                        'flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer text-sm transition-all',
                        isItemActive
                          ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/5'
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {isTitle ? (
                          <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
                        ) : (
                          <History className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">{item.text}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 opacity-60">
                        <span className="text-[10px] capitalize font-sans">
                          {item.source === 'title' ? 'Article Title' : 'Recent Search'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Search Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
          Try asking:
        </span>
        {popularTopics.map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => {
              setQuery(sample);
              onSearch(sample, mode);
            }}
            className="px-2.5 py-1 rounded-lg glass-panel hover:bg-slate-100/90 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/10 text-slate-600 dark:text-slate-300 text-[11px] transition-all hover:scale-[1.02]"
          >
            {sample}
          </button>
        ))}
      </div>
    </div>
  );
}
