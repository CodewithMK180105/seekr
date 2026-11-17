export interface ChunkItem {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

export interface ChunkerOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

/**
 * Approximates token count based on subword heuristics (~4 characters per token in English).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Combine word count heuristics with character count for reliable token approximation
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const charBasedTokens = Math.ceil(text.length / 4);
  return Math.max(wordCount, charBasedTokens);
}

/**
 * Splits text into natural sentence and paragraph segments.
 */
function splitIntoSentences(text: string): string[] {
  // Split on paragraph breaks or sentence terminators (. ? !) followed by space/capital letter
  const rawSegments = text.split(/(?<=[.?!])\s+(?=[A-Z0-9"'‘“])|(?<=\n\n+)/g);
  return rawSegments.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Splits document content into overlapping sliding-window chunks
 * while strictly preserving sentence boundaries.
 */
export function chunkDocument(
  text: string,
  options: ChunkerOptions = {}
): ChunkItem[] {
  const maxTokens = options.maxTokens ?? 400;
  const overlapTokens = options.overlapTokens ?? 40;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) {
    return [];
  }

  const totalEstimated = estimateTokenCount(text);
  if (totalEstimated <= maxTokens) {
    return [
      {
        chunkIndex: 0,
        content: text.trim(),
        tokenCount: totalEstimated,
      },
    ];
  }

  const chunks: ChunkItem[] = [];
  let currentSentences: string[] = [];
  let currentTokens = 0;
  let chunkIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokenCount(sentence);

    // If a single sentence exceeds maxTokens, include it as its own chunk
    if (sentenceTokens >= maxTokens && currentSentences.length === 0) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: sentence,
        tokenCount: sentenceTokens,
      });
      continue;
    }

    if (currentTokens + sentenceTokens > maxTokens && currentSentences.length > 0) {
      // Finalize current chunk
      const chunkText = currentSentences.join(' ');
      chunks.push({
        chunkIndex: chunkIndex++,
        content: chunkText,
        tokenCount: estimateTokenCount(chunkText),
      });

      // Calculate overlap: retain trailing sentences from current chunk for next chunk
      const retainedSentences: string[] = [];
      let retainedTokens = 0;

      for (let j = currentSentences.length - 1; j >= 0; j--) {
        const s = currentSentences[j];
        const sTokens = estimateTokenCount(s);
        if (retainedTokens + sTokens <= overlapTokens) {
          retainedSentences.unshift(s);
          retainedTokens += sTokens;
        } else {
          // If we haven't retained any sentence yet and overlap was requested,
          // retain the immediate prior sentence so semantic continuity is not abruptly broken
          if (retainedSentences.length === 0 && currentSentences.length > 1 && overlapTokens > 0) {
            retainedSentences.unshift(s);
            retainedTokens += sTokens;
          }
          break;
        }
      }

      currentSentences = [...retainedSentences, sentence];
      currentTokens = estimateTokenCount(currentSentences.join(' '));
    } else {
      currentSentences.push(sentence);
      currentTokens += sentenceTokens;
    }
  }

  // Push remaining sentences if present
  if (currentSentences.length > 0) {
    const chunkText = currentSentences.join(' ');
    // Only push if not completely redundant with the previous chunk
    if (chunks.length === 0 || chunks[chunks.length - 1].content !== chunkText) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: chunkText,
        tokenCount: estimateTokenCount(chunkText),
      });
    }
  }

  return chunks;
}
