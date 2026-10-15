// V4 (SavedView.astro) plays its filter once, when half of the drawing is on screen. Without
// this script, with motion reduced or without IntersectionObserver, the finished drawing stays.

export function bindSavedView(root: ParentNode = document): void {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
	const figures = root.querySelectorAll<HTMLElement>('[data-saved-view]');
	if (figures.length === 0) return;
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const figure = entry.target as HTMLElement;
				figure.dataset.play = '';
				observer.unobserve(figure);
			}
		},
		{ threshold: 0.5 },
	);
	figures.forEach((figure) => {
		figure.dataset.armed = '';
		observer.observe(figure);
	});
}
