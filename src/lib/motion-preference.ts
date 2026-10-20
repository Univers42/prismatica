// Whether the page may animate: the visitor's system has not asked for reduced
// motion, and they have not paused animations with the header button
// (`.motion-paused` on the root, set by scripts/theme.ts).

let reducedMotion: MediaQueryList | null = null;

export function motionAllowed(): boolean {
	reducedMotion ??= matchMedia('(prefers-reduced-motion: reduce)');
	return !reducedMotion.matches && !document.documentElement.classList.contains('motion-paused');
}
