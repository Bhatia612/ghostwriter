export function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}