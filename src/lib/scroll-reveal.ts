export function bindScrollReveal(): void {
	if (typeof IntersectionObserver === 'undefined') return;
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const candidates = document.querySelectorAll<HTMLElement>('[data-scroll-rise], [data-scroll-grow], [data-reveal], .section__head');
	if (candidates.length === 0) return;
	const io = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				entry.target.classList.add('is-revealed');
				io.unobserve(entry.target);
			}
		}
	}, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
	candidates.forEach((node) => {
		node.classList.add('reveal-prep');
		io.observe(node);
	});
}
