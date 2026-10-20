// Marks the nav link of the section being read with aria-current="location".
// "Being read" means crossing a thin band 35–40% down the viewport, so a
// section counts once its heading has scrolled up toward the reader's eyes,
// not the moment its first pixel appears.
// Caveat: a linked section shorter than the band's distance to the next one
// can be skipped by a fast fling; the mark then jumps straight to the next.
export function bindSectionSpy(links: Iterable<HTMLAnchorElement>): () => void {
	const linkFor = new Map<Element, HTMLAnchorElement>();
	for (const link of links) {
		const id = link.hash.slice(1);
		const section = id ? document.getElementById(id) : null;
		if (section) linkFor.set(section, link);
	}
	const visible = new Set<Element>();
	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (entry.isIntersecting) visible.add(entry.target);
			else visible.delete(entry.target);
		}
		const sections = [...linkFor.keys()];
		const active = sections.find((section) => visible.has(section));
		linkFor.forEach((link, section) => {
			if (section === active) link.setAttribute('aria-current', 'location');
			else link.removeAttribute('aria-current');
		});
	}, { rootMargin: '-35% 0px -60% 0px' });
	linkFor.forEach((_link, section) => observer.observe(section));
	return () => observer.disconnect();
}
