import type { Memory } from "@t3tools/contracts";

const DAY_MS = 86_400_000;
const RECENCY_HALF_LIFE_DAYS = 90;
const PROJECT_BOOST = 1.25;

/** Letters and digits of any script, lowercased; one-character terms match too much to rank. */
export function memoryTerms(text: string): ReadonlyArray<string> {
  const terms =
    text
      .normalize("NFC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  return Array.from(new Set(terms.filter((term) => term.length >= 2)));
}

/** A term matches a word it starts, or that starts it, once it is long enough to mean something. */
function matchesWord(term: string, word: string): boolean {
  if (term === word) return true;
  if (term.length < 4 || word.length < 4) return false;
  return word.startsWith(term) || term.startsWith(word);
}

/**
 * Ranks memories against a query by term overlap, weighting rare terms higher,
 * then by recency and scope. No query keeps the order given. Memories that
 * share no term with the query are dropped.
 */
export function rankMemories(
  memories: ReadonlyArray<Memory>,
  query: string,
  now: number,
): ReadonlyArray<Memory> {
  const terms = memoryTerms(query);
  if (terms.length === 0) return memories;
  const words = memories.map((memory) => memoryTerms(memory.text));
  const documentFrequency = terms.map(
    (term) => words.filter((list) => list.some((word) => matchesWord(term, word))).length,
  );
  const scored: Array<{ readonly memory: Memory; readonly score: number }> = [];
  memories.forEach((memory, index) => {
    let relevance = 0;
    terms.forEach((term, termIndex) => {
      if (!words[index]!.some((word) => matchesWord(term, word))) return;
      relevance += Math.log(1 + memories.length / (1 + documentFrequency[termIndex]!));
    });
    if (relevance === 0) return;
    const ageDays = Math.max(0, now - Date.parse(memory.updatedAt)) / DAY_MS;
    const recency = 1 + 0.5 * Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
    const scope = memory.scope === "project" ? PROJECT_BOOST : 1;
    scored.push({ memory, score: relevance * recency * scope });
  });
  return scored.toSorted((a, b) => b.score - a.score).map(({ memory }) => memory);
}
