import { AssembledSource } from './types.js';

export interface VerifiedCitation {
  citationId: string; // e.g. "[1]"
  citationIndex: number; // 1-based index
  chunkId?: string;
  documentId?: string;
  title?: string;
  url?: string;
  sourceType?: string;
  score?: number;
  claim: string; // The primary sentence or statement containing the citation
  claims?: string[]; // All sentences/statements where this citation was referenced
  excerpt?: string; // Exact or best-matching supporting sentence from source content
  isVerified: boolean; // Provenance verified (source exists in context)
  verificationStatus: 'verified' | 'unsupported_source' | 'invalid_index';
  reason?: string;
  confidenceScore?: number; // Lexical similarity score between claim and excerpt
}

export interface CitationVerificationResult {
  citations: VerifiedCitation[];
  validCount: number;
  invalidCount: number;
  uncitedSourceCount: number;
  uncitedSources: AssembledSource[];
  claimsWithoutCitations: string[];
}

export class CitationPostProcessor {
  /**
   * Parses, validates, and aligns citations from generated research answers with retrieved source chunks.
   */
  public process(answer: string, sources: AssembledSource[]): CitationVerificationResult {
    if (!answer || !answer.trim()) {
      return {
        citations: [],
        validCount: 0,
        invalidCount: 0,
        uncitedSourceCount: sources.length,
        uncitedSources: [...sources],
        claimsWithoutCitations: [],
      };
    }

    const sourceMap = new Map<number, AssembledSource>();
    for (const src of sources) {
      sourceMap.set(src.citationIndex, src);
    }

    const sentences = this.splitIntoSentences(answer);
    const verifiedCitations: VerifiedCitation[] = [];
    const citedIndices = new Set<number>();
    const claimsWithoutCitations: string[] = [];

    for (const sentence of sentences) {
      const citationRegex = /\[(\d+)\]/g;
      const matches = Array.from(sentence.matchAll(citationRegex));

      if (matches.length === 0) {
        // Record claim without citations if it contains substantive words
        if (sentence.trim().length > 15) {
          claimsWithoutCitations.push(sentence.trim());
        }
        continue;
      }

      // Clean the claim text for display
      const cleanClaim = sentence.trim();

      for (const match of matches) {
        const index = parseInt(match[1], 10);
        citedIndices.add(index);
        const citationId = `[${index}]`;

        const source = sourceMap.get(index);

        if (!source) {
          // Model cited a number that was never provided in the context
          verifiedCitations.push({
            citationId,
            citationIndex: index,
            claim: cleanClaim,
            isVerified: false,
            verificationStatus: index <= 0 ? 'invalid_index' : 'unsupported_source',
            reason: `Citation ${citationId} does not correspond to any source provided in the context.`,
          });
          continue;
        }

        // Extract the best-matching supporting excerpt from the source chunk
        const { excerpt, similarity } = this.extractSupportingExcerpt(cleanClaim, source.content);

        verifiedCitations.push({
          citationId,
          citationIndex: index,
          chunkId: source.chunkId,
          documentId: source.documentId,
          title: source.title,
          url: source.url,
          sourceType: source.sourceType,
          score: source.score,
          claim: cleanClaim,
          excerpt,
          isVerified: true,
          verificationStatus: 'verified',
          reason: 'Source chunk provenance matched in retrieved context.',
          confidenceScore: similarity,
        });
      }
    }

    // Deduplicate citations by citationIndex while aggregating all claim sentences
    const citationMap = new Map<number, VerifiedCitation>();

    for (const c of verifiedCitations) {
      const existing = citationMap.get(c.citationIndex);
      if (!existing) {
        citationMap.set(c.citationIndex, {
          ...c,
          claims: [c.claim],
        });
      } else {
        if (!existing.claims?.includes(c.claim)) {
          existing.claims?.push(c.claim);
        }
      }
    }

    const uniqueCitations = Array.from(citationMap.values()).sort(
      (a, b) => a.citationIndex - b.citationIndex
    );

    const validCount = uniqueCitations.filter((c) => c.isVerified).length;
    const invalidCount = uniqueCitations.filter((c) => !c.isVerified).length;

    // Detect sources that were provided but never cited
    const uncitedSources = sources.filter((s) => !citedIndices.has(s.citationIndex));

    return {
      citations: uniqueCitations,
      validCount,
      invalidCount,
      uncitedSourceCount: uncitedSources.length,
      uncitedSources,
      claimsWithoutCitations,
    };
  }

  /**
   * Splits text into logical sentence units while keeping inline citations attached.
   */
  private splitIntoSentences(text: string): string[] {
    // Splits on period, exclamation, or question mark followed by whitespace or end of line,
    // without splitting on abbreviations like e.g., i.e., or numbers.
    const rawSentences = text
      .split(/(?<=[.?!])\s+(?=[A-Z0-9\[])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return rawSentences.length > 0 ? rawSentences : [text.trim()];
  }

  /**
   * Extracts the sentence from the source chunk that has the highest lexical word overlap
   * with the cited claim.
   */
  public extractSupportingExcerpt(claim: string, sourceContent: string): { excerpt: string; similarity: number } {
    if (!sourceContent) {
      return { excerpt: '', similarity: 0 };
    }

    const sourceSentences = sourceContent
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    if (sourceSentences.length === 0) {
      const snippet = sourceContent.slice(0, 250).trim();
      return { excerpt: snippet, similarity: 0.5 };
    }

    // Tokenize claim into lowercase substantive keywords (min 3 chars, letters only)
    const claimWords = new Set(
      claim
        .toLowerCase()
        .replace(/\[\d+\]/g, '')
        .match(/[a-z0-9_-]{3,}/g) || []
    );

    if (claimWords.size === 0) {
      return { excerpt: sourceSentences[0], similarity: 0.5 };
    }

    let bestSentence = sourceSentences[0];
    let bestScore = -1;

    for (const sentence of sourceSentences) {
      const sentenceWords = new Set(
        sentence.toLowerCase().match(/[a-z0-9_-]{3,}/g) || []
      );

      let matches = 0;
      for (const w of claimWords) {
        if (sentenceWords.has(w)) matches++;
      }

      // Jaccard-like keyword overlap
      const score = matches / Math.max(1, claimWords.size);

      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence;
      }
    }

    return {
      excerpt: bestSentence,
      similarity: Math.round(Math.max(0.1, bestScore) * 100) / 100,
    };
  }
}
