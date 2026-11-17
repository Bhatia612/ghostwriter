const DAY_MS = 24 * 60 * 60 * 1000;

export function msUntilUtcMidnight(now: Date): number {
  const elapsedToday = now.getTime() % DAY_MS;
  return DAY_MS - elapsedToday;
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function formatUtcDate(now: Date): string {
  return now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}