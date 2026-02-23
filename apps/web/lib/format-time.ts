/**
 * Within the last 10 minutes → "X mins ago" (or "just now")
 * Older → actual date, e.g. "Feb 22" or "Feb 22, 2025"
 */
export function formatReportTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 10) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;

  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
