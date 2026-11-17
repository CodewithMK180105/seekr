import crypto from 'crypto';

export interface NormalizedResult {
  normalizedText: string;
  contentHash: string;
  charCount: number;
}

/**
 * Normalizes extracted text:
 * - Unicode NFKC normalization
 * - Collapses repeated whitespace while preserving paragraph breaks
 * - Computes a deterministic SHA-256 content hash for duplicate & version detection
 */
export function normalizeTextAndHash(rawText: string): NormalizedResult {
  const normalizedText = rawText
    .normalize('NFKC')
    .replace(/\u00A0/g, ' ')               // non-breaking space
    .replace(/[ \t]+/g, ' ')               // collapse horizontal whitespace
    .replace(/\n[ \t]+/g, '\n')            // trim lines
    .replace(/\n{3,}/g, '\n\n')            // collapse 3+ newlines into double newlines
    .trim();

  const contentHash = crypto
    .createHash('sha256')
    .update(normalizedText, 'utf8')
    .digest('hex');

  return {
    normalizedText,
    contentHash,
    charCount: normalizedText.length,
  };
}
