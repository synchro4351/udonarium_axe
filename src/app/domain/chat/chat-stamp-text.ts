/**
 * A line's words for a short preview, or the stamp's name in brackets for a stamp sent without
 * any, so a reply to a stamp does not quote nothing.
 */
export function previewTextOf(line: { readonly text: string | null | undefined; readonly stampName?: string }): string {
  const text = line.text ?? '';
  if (text.trim().length > 0 || !line.stampName) return text;
  return `[${line.stampName}]`;
}
