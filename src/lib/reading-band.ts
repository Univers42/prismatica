// Tracks which target sits in the "reading band" — a thin strip of the
// viewport about 35–40% down — and reports each change of the active target,
// where active means the first target in the given order that is visible.
// Caveat: a linked section shorter than the band's distance to the next one
// can be skipped by a fast fling; the mark then jumps straight to the next.
export function observeReadingBand<T extends Element>(
	targets: Iterable<T>,
	onChange: (active: T | null) => void,
	rootMargin = '-35% 0px -60% 0px',
): () => void {
	const order = [...targets];
	if (typeof IntersectionObserver === 'undefined') return () => {};
	const visible = new Set<Element>();
	let active: T | null = null;
	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (entry.isIntersecting) visible.add(entry.target);
			else visible.delete(entry.target);
		}
		const next = order.find((target) => visible.has(target)) ?? null;
		if (next === active) return;
		active = next;
		onChange(active);
	}, { rootMargin });
	for (const target of order) observer.observe(target);
	return () => observer.disconnect();
}
