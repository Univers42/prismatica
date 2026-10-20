// One-shot entrances for content below the hero (styles: utilities/_scroll-effects.scss).
// Elements only get hidden once this runs, so without JS, under reduced motion
// or with the hero's pause button on, everything is simply visible.
import { motionAllowed } from './motion-preference';

const REVEAL_SELECTOR = '[data-scroll-rise], [data-scroll-grow], [data-reveal], .section__head';
const STAGGER_MS = 70;
const MAX_STAGGER_STEPS = 5;

// Elements that enter in the same frame cascade instead of landing at once;
// the cap keeps a long row from leaving its last item waiting.
export function staggerDelay(order: number): number {
	return Math.min(order, MAX_STAGGER_STEPS) * STAGGER_MS;
}

function byPageOrder(a: Element, b: Element): number {
	return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

export function bindScrollReveal(): void {
	if (typeof IntersectionObserver === 'undefined' || !motionAllowed()) return;
	const candidates = document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR);
	if (candidates.length === 0) return;
	// Threshold 0 with a bottom margin, not a visible ratio: an element taller
	// than the viewport divided by the ratio would otherwise never reveal.
	const io = new IntersectionObserver((entries) => {
		const entering = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target as HTMLElement);
		entering.sort(byPageOrder).forEach((node, order) => {
			node.style.setProperty('--reveal-delay', `${staggerDelay(order)}ms`);
			node.classList.add('is-revealed');
			io.unobserve(node);
		});
	}, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
	candidates.forEach((node) => {
		node.classList.add('reveal-prep');
		io.observe(node);
	});
}
