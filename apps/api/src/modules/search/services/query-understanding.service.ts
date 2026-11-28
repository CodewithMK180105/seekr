/**
 * Query Understanding Service
 * 
 * Provides robust, generic query classification, normalization, keyword extraction,
 * and intent detection without hardcoded person names, cities, or domain-specific heuristics.
 */

export type QueryCategory =
  | 'FACTUAL'
  | 'CONCEPTUAL'
  | 'TROUBLESHOOTING'
  | 'COMPARISON'
  | 'TECHNICAL_KEYWORD'
  | 'DIRECT_URL'
  | 'GIBBERISH'
  | 'AMBIGUOUS_SHORT';

export interface ParsedQuery {
  /** The untouched original query entered by the user */
  originalQuery: string;
  /** Normalized query with excess whitespace cleaned, retaining technical punctuation */
  normalizedQuery: string;
  /** Stripped query for lexical search engines without conversational prefixes */
  cleanedQuery: string;
  /** Core meaningful keywords extracted for relevance scoring */
  coreKeywords: string[];
  /** Primary named entity or subject candidate */
  entityCandidate?: string;
  /** Primary classified intent */
  category: QueryCategory;
  /** Whether the query has conversational phrasing (e.g. "Can you tell me...") */
  isConversational: boolean;
  /** Whether the query explicitly requests recent/fresh information */
  requiresFreshness: boolean;
  /** Whether the query is classified as gibberish/keyboard-mashing */
  isGibberish: boolean;
  /** Classification confidence score (0 to 1.0) */
  confidence: number;
}

const COMMON_STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any',
  'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between',
  'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he',
  'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in',
  'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then',
  'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until',
  'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who',
  'whom', 'why', 'will', 'with', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

const CONVERSATIONAL_PREFIX_REGEX = /^(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:can\s+you\s+)?(?:tell\s+me(?:\s+everything|\s+all|\s+more)?(?:\s+(?:about|on))?|give\s+me(?:\s+the)?\s+(?:details|information|info)(?:\s+(?:about|on|for))?|show\s+me(?:\s+information|\s+info)?(?:\s+(?:about|on))?|provide\s+(?:details|information|info)(?:\s+(?:about|on|for))?|explain(?:\s+to\s+me)?(?:\s+(?:about|how))?|what\s+(?:is|are|was|were)|who\s+(?:is|was|were)|where\s+(?:is|was|were)|why\s+(?:is|was|are|does|do)|how\s+(?:does|do|can|to))\s+/i;

const TROUBLESHOOTING_REGEX = /\b(fail|failing|failed|error|deadlock|oom|crash|exception|timeout|slow|debug|troubleshoot|fix|issue|problem|broken|recovering|retry|retrying)\b/i;

const COMPARISON_REGEX = /\b(vs|versus|difference\s+between|compare|compared\s+to|better\s+than|or)\b/i;

const FRESHNESS_REGEX = /\b(latest|recent|recently|newest|current|today|2024|2025|2026|new|updated|release\s+notes)\b/i;

const URL_REGEX = /^(https?:\/\/[^\s]+|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?)$/i;

export class QueryUnderstandingService {
  /**
   * Parses and classifies a user search query.
   */
  parseQuery(rawQuery: string): ParsedQuery {
    const originalQuery = typeof rawQuery === 'string' ? rawQuery.trim() : '';
    if (!originalQuery) {
      return {
        originalQuery: '',
        normalizedQuery: '',
        cleanedQuery: '',
        coreKeywords: [],
        category: 'GIBBERISH',
        isConversational: false,
        requiresFreshness: false,
        isGibberish: true,
        confidence: 1.0,
      };
    }

    // 1. Direct URL detection
    if (URL_REGEX.test(originalQuery)) {
      return {
        originalQuery,
        normalizedQuery: originalQuery,
        cleanedQuery: originalQuery,
        coreKeywords: [originalQuery],
        category: 'DIRECT_URL',
        isConversational: false,
        requiresFreshness: false,
        isGibberish: false,
        confidence: 0.98,
      };
    }

    // 2. Gibberish detection
    const isGibberish = this.detectGibberish(originalQuery);
    if (isGibberish) {
      return {
        originalQuery,
        normalizedQuery: originalQuery.toLowerCase(),
        cleanedQuery: originalQuery,
        coreKeywords: [],
        category: 'GIBBERISH',
        isConversational: false,
        requiresFreshness: false,
        isGibberish: true,
        confidence: 0.95,
      };
    }

    // 3. Normalized query (collapse spaces, keep case for acronyms/entities)
    const normalizedQuery = originalQuery.replace(/\s+/g, ' ');

    // 4. Conversational prefix detection & cleaning
    const isConversational = CONVERSATIONAL_PREFIX_REGEX.test(normalizedQuery);
    let cleanedQuery = normalizedQuery.replace(CONVERSATIONAL_PREFIX_REGEX, '').replace(/[?!.]+$/, '').trim();
    if (!cleanedQuery) {
      cleanedQuery = normalizedQuery;
    }

    // 5. Freshness intent
    const requiresFreshness = FRESHNESS_REGEX.test(normalizedQuery);

    // 6. Keyword extraction
    const coreKeywords = this.extractKeywords(cleanedQuery);

    // 7. Entity candidate (first proper noun phrase or cleaned core)
    const entityCandidate = this.extractEntityCandidate(cleanedQuery);

    // 8. Category classification
    const category = this.classifyCategory(normalizedQuery, coreKeywords);

    return {
      originalQuery,
      normalizedQuery,
      cleanedQuery,
      coreKeywords,
      entityCandidate,
      category,
      isConversational,
      requiresFreshness,
      isGibberish: false,
      confidence: 0.90,
    };
  }

  /**
   * Extracts meaningful keywords while preserving technical terms and short acronyms.
   */
  extractKeywords(text: string): string[] {
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9_\-+#.]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0);

    const keywords: string[] = [];
    for (const t of tokens) {
      // Clean leading/trailing punctuation while preserving C++, .NET, etc.
      const cleaned = t.replace(/^[.\-_]+|[.\-_]+$/g, '');
      if (cleaned.length === 0) continue;

      // Allow valid 2-letter tech acronyms (e.g. go, ip, ai, db, io, os, vm, ci, cd)
      if (cleaned.length === 1 && !['c', 'r'].includes(cleaned)) continue;

      if (!COMMON_STOP_WORDS.has(cleaned)) {
        keywords.push(cleaned);
      }
    }

    return keywords.length > 0 ? keywords : tokens.filter((t) => t.length > 1);
  }

  /**
   * Generic gibberish and keyboard mash detector.
   * Protects legitimate technical terms, acronyms, and foreign names.
   */
  detectGibberish(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length < 3) return false;

    // Check for extreme repeated punctuation/symbols: e.g. !@#$%^&*
    const alphaCount = (trimmed.match(/[a-zA-Z0-9]/g) || []).length;
    if (alphaCount === 0 || alphaCount / trimmed.length < 0.3) {
      return true;
    }

    const words = trimmed.split(/\s+/);
    if (words.length === 1) {
      const word = words[0];
      const lower = word.toLowerCase();

      // Check if it's an all-caps acronym of 2 to 6 letters (e.g. SSRF, HNSW, RDB, AOF, CRUD)
      if (/^[A-Z]{2,6}$/.test(word)) {
        return false;
      }

      // Check alphanumeric tech terms like K8s, IPv6, B2B, MP3, S3
      if (/^[a-zA-Z0-9]{2,6}$/.test(word) && /\d/.test(word) && /[a-zA-Z]/.test(word)) {
        return false;
      }

      // 4+ identical consecutive characters: e.g. aaaaa, zzzzz
      if (/(.)\1{3,}/.test(lower)) {
        return true;
      }

      // Letters-only inspection
      const alphaOnly = lower.replace(/[^a-z]/g, '');
      if (alphaOnly.length >= 5) {
        const vowels = (alphaOnly.match(/[aeiouy]/g) || []).length;

        // In English/Latin text, words of 5+ letters with zero vowels are gibberish (e.g. fttxtx, bcdfgh, jklmnp)
        if (vowels === 0) {
          return true;
        }

        // 5+ consecutive consonants without vowel (except common linguistic roots)
        if (/[^aeiouy]{5,}/.test(alphaOnly)) {
          const exceptions = ['strengths', 'lengths', 'angsts', 'catchphrase', 'rhythms', 'glycyl'];
          if (!exceptions.some((ex) => alphaOnly.includes(ex))) {
            return true;
          }
        }

        // Keyboard row mash: e.g. asdfgh, asdfghjk, qwertyuiop, zxcvbn
        const mashPatterns = [
          'asdfgh', 'dfghjk', 'fghjkl',
          'qwerty', 'wertyu', 'ertyui', 'rtyuio', 'tyuiop',
          'zxcvbn', 'xcvbnm'
        ];
        if (mashPatterns.some((pat) => alphaOnly.includes(pat))) {
          return true;
        }
      }
    }

    return false;
  }

  private extractEntityCandidate(cleanedQuery: string): string | undefined {
    // Strip leading articles
    const stripped = cleanedQuery.replace(/^(the|a|an)\s+/i, '').trim();
    if (!stripped) return undefined;

    // Direct capitalized multi-word phrases or single subject
    const words = stripped.split(/\s+/);
    if (words.length <= 4) {
      return stripped;
    }
    return words.slice(0, 3).join(' ');
  }

  private classifyCategory(query: string, keywords: string[]): QueryCategory {
    if (COMPARISON_REGEX.test(query)) {
      return 'COMPARISON';
    }
    if (TROUBLESHOOTING_REGEX.test(query)) {
      return 'TROUBLESHOOTING';
    }
    if (/^(how\s+(does|do|can|to)|what\s+is\s+(the\s+concept\s+of|a)?|explain)\b/i.test(query)) {
      return 'CONCEPTUAL';
    }
    if (/^(who\s+is|where\s+is|what\s+is\s+the\s+capital)\b/i.test(query)) {
      return 'FACTUAL';
    }
    if (keywords.length <= 2) {
      return 'AMBIGUOUS_SHORT';
    }
    return 'TECHNICAL_KEYWORD';
  }
}

export const queryUnderstandingService = new QueryUnderstandingService();
