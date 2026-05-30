import type { Slot } from '../config/schema.js';

/** Resolve every declared copy key for a locale, falling back to defaultLocale then ''. */
export function resolveCopy(slot: Slot, locale: string, defaultLocale: string): Record<string, string> {
  const copy: Record<string, string> = {};
  for (const key of Object.keys(slot.copy)) {
    copy[key] = slot.copy[key]?.[locale] ?? slot.copy[key]?.[defaultLocale] ?? '';
  }
  return copy;
}
