/** A machine login code as the field shows it: up to eight letters and digits, upper-cased, as `XXXX-XXXX`. */
export function formatMachineCode(typed: string): string {
  const cleaned = typed
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned;
}
