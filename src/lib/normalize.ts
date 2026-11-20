/**
 * Loose comparison for Kapampangan answers: learners spell the same word several ways —
 * old Spanish-style vs modern K spelling, accents, hyphens, doubled vowels.
 */
export function normalizeRoman(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip macrons/accents
    .replace(/[-_'’`]/g, ' ')
    .replace(/[?!.,،؟;:"]/g, '')
    .replace(/oo/g, 'u')
    .replace(/ee/g, 'i')
    .replace(/aa/g, 'a')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(s: string): string[] {
  return s.replace(/[?!.,،؟;:"]/g, '').split(/\s+/).filter(Boolean)
}
