// Local date formatting helper for the form pickers.
// Inlined from fitstake/utils/date.ts so @jv/forms stays self-contained.

export function formatToYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTime(date: Date | undefined, is24Hour: boolean): string {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !is24Hour });
}
