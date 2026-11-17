'use client';

import React, { useState } from 'react';
import { Search, Database, Globe, RefreshCw, CheckCircle2, AlertCircle, Layers } from 'lucide-react';

export default function HomePage() {
  const [query, setQuery] = useState('');

  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium tracking-wide">
          <Layers className="w-3.5 h-3.5" /> Phase 2 Ingestion & Orchestration Active
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-white bg-clip-text text-transparent">
          Seekr
        </h1>
        <p className="text-gray-400 text-base max-w-xl mx-auto">
          AI-Powered Hybrid Search & Research Engine combining PostgreSQL Full-Text Search, pgvector, Reciprocal Rank Fusion, and RAG.
        </p>

        {/* Search Input Preview */}
        <div className="max-w-2xl mx-auto mt-8 relative">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 absolute left-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across indexed documents (e.g. 'How does Redis recover data?')..."
              className="w-full pl-12 pr-28 py-3.5 rounded-xl bg-gray-900/80 border border-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-lg"
            />
            <button className="absolute right-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow">
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Content Ingestion */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 backdrop-blur space-y-3">
          <div className="flex items-center gap-3 text-blue-400">
            <Globe className="w-5 h-5" />
            <h2 className="font-semibold text-gray-100">Web Crawler</h2>
          </div>
          <p className="text-sm text-gray-400">
            Asynchronous BullMQ crawler respecting robots.txt and guarding against SSRF. Extracts clean text and handles link discovery.
          </p>
          <div className="pt-2 flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> SSRF & Robots Guards Active
          </div>
        </div>

        {/* Card 2: Document Persistence */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 backdrop-blur space-y-3">
          <div className="flex items-center gap-3 text-indigo-400">
            <Database className="w-5 h-5" />
            <h2 className="font-semibold text-gray-100">Document Persistence</h2>
          </div>
          <p className="text-sm text-gray-400">
            Raw documents and metadata are persisted in PostgreSQL before chunking. SHA-256 hashes detect content updates and trigger re-indexing.
          </p>
          <div className="pt-2 flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> Version Hashing Active
          </div>
        </div>

        {/* Card 3: Decoupled Queue Pipeline */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 backdrop-blur space-y-3">
          <div className="flex items-center gap-3 text-purple-400">
            <RefreshCw className="w-5 h-5" />
            <h2 className="font-semibold text-gray-100">Indexing Pipeline</h2>
          </div>
          <p className="text-sm text-gray-400">
            Independent BullMQ indexing queue decouples web crawling from vector embedding generation, enabling independent retries and throttling.
          </p>
          <div className="pt-2 flex items-center gap-2 text-xs text-blue-400">
            <AlertCircle className="w-4 h-4" /> Ready for Phase 3 Chunking
          </div>
        </div>
      </div>
    </main>
  );
}
