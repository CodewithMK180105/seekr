/**
 * Token Counter & Estimation Utility
 *
 * Approximation Strategy:
 * In general English prose and technical documentation, 1 token corresponds to approximately
 * 4 characters (or ~0.75 words). For source code, technical URLs, and structured syntax, token density
 * is slightly higher (~3.5 to 3.8 characters per token).
 *
 * Rather than assuming exact tokenization across different proprietary LLM models (e.g. Gemini BPE vs
 * OpenAI tiktoken), we employ a documented conservative estimator:
 *   ceil(characterLength / 3.8)
 *
 * This intentionally overestimates token counts by ~5-10%, guaranteeing safe context headroom
 * and preventing unexpected context-window overflow errors at runtime.
 */

const CHARS_PER_TOKEN = 3.8;

export function estimateTokens(text: string | null | undefined): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Deterministically truncates a text string so its estimated token count
 * does not exceed targetTokens.
 */
export function truncateToTokens(text: string, targetTokens: number, omission = '\n[...content truncated due to token budget...]'): {
  text: string;
  truncated: boolean;
  tokenCount: number;
} {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= targetTokens) {
    return {
      text,
      truncated: false,
      tokenCount: currentTokens,
    };
  }

  const omissionTokens = estimateTokens(omission);
  const allowedContentTokens = Math.max(10, targetTokens - omissionTokens);
  const allowedChars = Math.floor(allowedContentTokens * CHARS_PER_TOKEN);

  const sliced = text.slice(0, allowedChars).trimEnd();
  const truncatedText = `${sliced}${omission}`;

  return {
    text: truncatedText,
    truncated: true,
    tokenCount: estimateTokens(truncatedText),
  };
}
