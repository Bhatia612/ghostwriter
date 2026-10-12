import { fnv1a, mulberry32 } from "./prng.js";
import { WORDS } from "./words.js";

export const PASSAGE_WORD_COUNT = 30;

export function generatePassage(
  seed: number,
  words: readonly string[] = WORDS,
  count: number = PASSAGE_WORD_COUNT
): string {
  if (words.length === 0) throw new Error("word list is empty");
  const rand = mulberry32(seed);
  const picked: string[] = [];
  while (picked.length < count) {
    const word = words[Math.floor(rand() * words.length)];
    if (word === undefined) throw new Error("index out of range");
    if (words.length > 1 && word === picked.at(-1)) continue;
    picked.push(word);
  }
  return picked.join(" ");
}

export function dailySeed(dateKey: string, secret: string): number {
  if (!secret) throw new Error("daily seed secret is required");
  return fnv1a(`daily:${secret}:${dateKey}`);
}

export function dailyPassage(dateKey: string, secret: string): string {
  return generatePassage(dailySeed(dateKey, secret));
}