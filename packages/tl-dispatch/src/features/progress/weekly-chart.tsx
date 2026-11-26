export function formatLeadDays(days: number | null): string {
  return days === null ? "—" : days.toFixed(1);
}
