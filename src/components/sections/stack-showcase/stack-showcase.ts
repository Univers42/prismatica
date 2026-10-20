// Wires the stack showcase: tabs pick the iPad slide (a horizontal swipe
// does too on touch screens), the page dots follow, the graph only animates
// while its slide is open, and the "why" slide replays each time it opens.

import { bindTabs } from '../../../lib/tabs';
import { bindScaleDiagram } from './scale-diagram';
import { bindStackGraph } from './stack-graph';

// A swipe must travel this far, and mostly sideways, to change slide.
const SWIPE_PX = 50;

function replay(panel: HTMLElement | undefined): void {
	if (!panel) return;
	panel.removeAttribute('data-play');
	void panel.offsetWidth;
	panel.setAttribute('data-play', '');
}

function bindSwipe(surface: HTMLElement, onSwipe: (step: 1 | -1) => void): void {
	let start: { x: number; y: number } | null = null;
	surface.addEventListener('pointerdown', (event) => {
		start = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
	});
	surface.addEventListener('pointercancel', () => { start = null; });
	surface.addEventListener('pointerup', (event) => {
		if (!start) return;
		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		start = null;
		if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
	});
}

export function initStackShowcase(): void {
	const root = document.querySelector<HTMLElement>('[data-showcase]');
	const screen = root?.querySelector<HTMLElement>('[data-showcase-screen]');
	if (!root || !screen) return;
	const graphRoot = root.querySelector<HTMLElement>('[data-stack-graph]');
	const scaleRoot = root.querySelector<HTMLElement>('[data-scale]');
	const graph = graphRoot ? bindStackGraph(graphRoot) : null;
	if (scaleRoot) bindScaleDiagram(scaleRoot);
	const panels = [...root.querySelectorAll<HTMLElement>('[data-showcase-panel]')];
	const dots = [...root.querySelectorAll<HTMLElement>('[data-showcase-dot]')];
	const isGraph = (index: number) => panels[index]?.dataset.showcasePanel === 'graph';

	const tabs = bindTabs(root, 'showcase', (index, previous) => {
		screen.dataset.direction = index > previous ? 'forward' : 'back';
		dots.forEach((dot, dotIndex) => dot.toggleAttribute('data-on', dotIndex === index));
		graph?.setActive(isGraph(index));
		replay(panels[index]);
	});
	if (!tabs) return;
	graph?.setActive(isGraph(tabs.selectedIndex()));
	bindSwipe(screen.querySelector<HTMLElement>('.ipad__slides') ?? screen, (step) => {
		const next = tabs.ids[tabs.selectedIndex() + step];
		if (next) tabs.select(next);
	});
}
