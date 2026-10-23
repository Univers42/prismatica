// Marks the nav link of the section being read with aria-current="location".
// "Being read" means crossing a thin band 35–40% down the viewport, so a
// section counts once its heading has scrolled up toward the reader's eyes,
// not the moment its first pixel appears.
import { observeReadingBand } from './reading-band';

export function bindSectionSpy(links: Iterable<HTMLAnchorElement>): () => void {
	const linkFor = new Map<Element, HTMLAnchorElement>();
	for (const link of links) {
		const id = link.hash.slice(1);
		const section = id ? document.getElementById(id) : null;
		if (section) linkFor.set(section, link);
	}
	return observeReadingBand(linkFor.keys(), (active) => {
		linkFor.forEach((link, section) => {
			if (section === active) link.setAttribute('aria-current', 'location');
			else link.removeAttribute('aria-current');
		});
	});
}
