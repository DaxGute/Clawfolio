const DAY_MS = 24 * 60 * 60 * 1000;

export function isRunOlderThanDay(lastRunAt: string | null): boolean {
  if (!lastRunAt) return true;
  return Date.now() - new Date(lastRunAt).getTime() > DAY_MS;
}

export function formatLastRun(iso: string | null): string {
  if (!iso) return "No run yet";
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
  return `${when} PT`;
}
