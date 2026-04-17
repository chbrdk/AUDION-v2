/**
 * When only one side of an EN/DE pair has text, copy it to the empty side so both DB columns
 * stay populated (draft UX). Replace with real translation when a dedicated translate API exists.
 */
export function mirrorFillStringPair(en: string, de: string): { en: string; de: string } {
  const te = en.trim();
  const td = de.trim();
  if (te && !td) {
    return { en, de: te };
  }
  if (td && !te) {
    return { en: td, de };
  }
  return { en, de };
}
