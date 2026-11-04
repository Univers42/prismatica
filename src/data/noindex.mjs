// Transactional landings: their pages send noindex, the sitemap skips them, and robots.txt
// disallows them. One list for all three.
export const NOINDEX_PREFIXES = ['/auth/', '/newsletter/'];
