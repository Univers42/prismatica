// The hero sky on one canvas behind the copy: the star field (sky-stars.ts),
// the planet under the devices (sky-planet.ts), and the constellation of
// business items with the signals that run between them. The item chips are
// server-rendered and placed by CSS; this measures them, drifts them, leans
// the whole sky toward the pointer, and draws the lines. When the laptop's
// workspace inserts an app ('workspace:select'), that app's items light up and
// beam down into its sidebar tile.
// Caveat: positions are measured on resize and at each select. A shift that
// moves the page without resizing the hero (a late font swap, the laptop's
// scroll animation) leaves a beam aimed a few pixels off until the next one.

import { UNIVERSE_LINKS } from '../data/universe';
import { motionAllowed } from '../lib/motion-preference';
import { createRandom, curvePoint, driftFor, driftOffset, easeInOut, type Drift, type Point } from '../lib/universe-motion';
import { createPlanet } from './sky-planet';
import { createStarField } from './sky-stars';

type SkyNode = { id: string; app: string; el: HTMLElement; mark: HTMLElement | null; base: Point; pos: Point; drift: Drift; shown: boolean };
type Signal = { from: SkyNode; to: SkyNode; start: number; duration: number };
type Story = { app: string; start: number; target: Point | null; nodes: SkyNode[] };

const STORY_MS = 2800;
const SIGNAL_EVERY_MS = 420;
const MAX_SIGNALS = 7;
// Caveat: a pixel budget, not a measured limit. A tall desktop hero at DPR 2
// would be ~11M canvas pixels; capping at 6M trades a little sharpness on
// the stars for memory and fill rate.
const MAX_CANVAS_PIXELS = 6_000_000;
const POINTER_EASE = 0.06;

function offsetWithin(el: HTMLElement, ancestor: HTMLElement): Point {
	let x = 0;
	let y = 0;
	let current: HTMLElement | null = el;
	while (current && current !== ancestor) {
		x += current.offsetLeft;
		y += current.offsetTop;
		current = current.offsetParent as HTMLElement | null;
	}
	return { x, y };
}

export function bindHeroUniverse(root: HTMLElement): (() => void) | null {
	const canvas = root.querySelector<HTMLCanvasElement>('[data-universe-canvas]');
	const context = canvas?.getContext('2d');
	if (!canvas || !context) return null;
	const ctx = context;
	const scene = root.parentElement ?? root;
	// The canvas normalises the colour to #rrggbb; one it cannot parse is ignored, leaving the red.
	ctx.fillStyle = '#e4002b';
	ctx.fillStyle = getComputedStyle(root).getPropertyValue('--sky-signal').trim() || '#e4002b';
	const signalColor = String(ctx.fillStyle);
	const stars = createStarField();
	const planet = createPlanet(signalColor);
	const nodes: SkyNode[] = [...root.querySelectorAll<HTMLElement>('[data-universe-node]')].map((el, index) => ({
		id: el.dataset.universeNode ?? '', app: el.dataset.app ?? '', el, mark: el.querySelector<HTMLElement>('.uv-node__mark'),
		base: { x: 0, y: 0 }, pos: { x: 0, y: 0 }, drift: driftFor(index), shown: true,
	}));
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const links = UNIVERSE_LINKS.map(([a, b]) => [byId.get(a), byId.get(b)] as const).filter((pair): pair is readonly [SkyNode, SkyNode] => Boolean(pair[0] && pair[1]));
	const random = createRandom(7);
	const pointer = { x: 0, y: 0 };
	const pointerTarget = { x: 0, y: 0 };
	let signals: Signal[] = [];
	let story: Story | null = null;
	let lastSignalAt = 0;
	let hoverId = '';
	let width = 0;
	let height = 0;
	let frame = 0;
	let onScreen = true;
	// Kept from scroll events: reading scrollY inside the frame forced a layout
	// whenever a timer had touched the DOM since the last paint (232 ms over a
	// 4x-CPU load trace, 2026-10-20).
	let scrollTop = window.scrollY;

	function measure(): void {
		width = root.clientWidth;
		height = root.clientHeight;
		const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height)));
		canvas!.width = Math.round(width * dpr);
		canvas!.height = Math.round(height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		for (const node of nodes) {
			node.shown = node.el.offsetParent !== null;
			node.base = offsetWithin(node.el, root);
		}
		const marker = scene.querySelector<HTMLElement>('[data-horizon]');
		const horizon = marker ? marker.getBoundingClientRect().top - root.getBoundingClientRect().top : height * 0.75;
		stars.measure(width, height);
		planet.measure(width, horizon, height);
	}

	function railTarget(app: string): Point | null {
		const tile = scene.querySelector<HTMLElement>(`[data-workspace-node="${app}"] .rail__tile`);
		if (!tile) return null;
		const box = tile.getBoundingClientRect();
		const origin = root.getBoundingClientRect();
		return { x: box.left - origin.left + box.width / 2, y: box.top - origin.top };
	}

	// Each item leans toward the pointer by its own depth (its drift radius),
	// so the constellation parallaxes instead of sliding as one sheet.
	function placeNodes(now: number, drifting: boolean): void {
		for (const node of nodes) {
			const offset = drifting ? driftOffset(node.drift, now) : { x: 0, y: 0 };
			const depth = node.drift.radius / 14;
			const x = offset.x + pointer.x * 14 * depth;
			const y = offset.y + pointer.y * 9 * depth;
			node.pos = { x: node.base.x + x, y: node.base.y + y };
			node.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
		}
	}

	function storyStrength(now: number): number {
		if (!story) return 0;
		const age = now - story.start;
		if (age > STORY_MS) return 0;
		return Math.min(1, age / 300, (STORY_MS - age) / 600);
	}

	function drawLinks(now: number): void {
		const strength = storyStrength(now);
		ctx.lineWidth = 1;
		for (const [a, b] of links) {
			if (!a.shown || !b.shown) continue;
			const lit = (story && strength > 0 && (a.app === story.app || b.app === story.app)) || a.id === hoverId || b.id === hoverId;
			ctx.strokeStyle = lit ? signalColor : '#ffffff';
			ctx.globalAlpha = lit ? 0.25 + 0.4 * Math.max(strength, hoverId ? 1 : 0) : 0.11;
			ctx.beginPath();
			ctx.moveTo(a.pos.x, a.pos.y);
			ctx.lineTo(b.pos.x, b.pos.y);
			ctx.stroke();
		}
	}

	function drawSignal(from: Point, control: Point, to: Point, t: number, color: string, alpha: number): void {
		const head = curvePoint(from, control, to, t);
		const tail = curvePoint(from, control, to, Math.max(0, t - 0.1));
		const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
		gradient.addColorStop(0, 'rgba(255,255,255,0)');
		gradient.addColorStop(1, color);
		ctx.globalAlpha = alpha;
		ctx.strokeStyle = gradient;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(tail.x, tail.y);
		ctx.lineTo(head.x, head.y);
		ctx.stroke();
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2);
		ctx.fill();
	}

	// A ring opens around an item's mark when a signal lands on it.
	function ping(node: SkyNode): void {
		node.mark?.animate?.(
			[{ outlineColor: 'rgba(255,255,255,0.75)', outlineOffset: '0px' }, { outlineColor: 'rgba(255,255,255,0)', outlineOffset: '7px' }],
			{ duration: 700, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
		);
	}

	function drawSignals(now: number): void {
		const visibleLinks = links.filter(([a, b]) => a.shown && b.shown);
		if (now - lastSignalAt > SIGNAL_EVERY_MS && signals.length < MAX_SIGNALS && visibleLinks.length > 0) {
			const [a, b] = visibleLinks[Math.floor(random() * visibleLinks.length)]!;
			const forward = random() > 0.5;
			signals.push({ from: forward ? a : b, to: forward ? b : a, start: now, duration: 1500 + random() * 1100 });
			lastSignalAt = now;
		}
		signals = signals.filter((signal) => {
			if (now - signal.start < signal.duration) return true;
			ping(signal.to);
			return false;
		});
		for (const signal of signals) {
			const t = easeInOut((now - signal.start) / signal.duration);
			const mid = { x: (signal.from.pos.x + signal.to.pos.x) / 2, y: (signal.from.pos.y + signal.to.pos.y) / 2 };
			drawSignal(signal.from.pos, mid, signal.to.pos, t, '#ffffff', 0.85);
		}
	}

	function drawStory(now: number): void {
		const strength = storyStrength(now);
		for (const node of nodes) node.el.classList.toggle('is-lit', Boolean(story && strength > 0 && node.app === story.app));
		if (!story || strength === 0 || !story.target) return;
		const travel = easeInOut(Math.min(1, (now - story.start) / 1300));
		for (const node of story.nodes) {
			const control = { x: node.pos.x + (story.target.x - node.pos.x) * 0.15, y: story.target.y - 40 };
			ctx.globalAlpha = 0.28 * strength;
			ctx.strokeStyle = signalColor;
			ctx.lineWidth = 1.25;
			ctx.beginPath();
			ctx.moveTo(node.pos.x, node.pos.y);
			ctx.quadraticCurveTo(control.x, control.y, story.target.x, story.target.y);
			ctx.stroke();
			if (travel < 1) drawSignal(node.pos, control, story.target, travel, signalColor, strength);
		}
	}

	function draw(now: number, moving: boolean): void {
		const scroll = moving ? scrollTop : 0;
		pointer.x += (pointerTarget.x - pointer.x) * POINTER_EASE;
		pointer.y += (pointerTarget.y - pointer.y) * POINTER_EASE;
		ctx.clearRect(0, 0, width, height);
		placeNodes(now, moving);
		stars.draw(ctx, now, moving, { scroll, pointer });
		planet.draw(ctx, now, moving);
		drawLinks(now);
		if (moving) drawSignals(now);
		drawStory(now);
		ctx.globalAlpha = 1;
	}

	const loop = (now: number): void => {
		const moving = motionAllowed();
		draw(now, moving);
		frame = onScreen && !document.hidden && moving ? requestAnimationFrame(loop) : 0;
	};
	const start = (): void => {
		if (!frame) frame = requestAnimationFrame(loop);
	};

	const resize = new ResizeObserver(() => {
		measure();
		start();
	});
	resize.observe(root);
	const visibility = new IntersectionObserver(([entry]) => {
		onScreen = Boolean(entry?.isIntersecting);
		if (onScreen) start();
	});
	visibility.observe(root);
	document.addEventListener('visibilitychange', start);
	// Pausing draws one still frame and stops; resuming restarts the loop.
	const motionToggle = new MutationObserver(start);
	motionToggle.observe(document.documentElement, { attributeFilter: ['class'] });

	// Pointer lean on mouse and trackpad only: a finger has no hover position.
	const onPointerMove = (event: PointerEvent): void => {
		if (event.pointerType !== 'mouse') return;
		const box = scene.getBoundingClientRect();
		pointerTarget.x = ((event.clientX - box.left) / box.width - 0.5) * 2;
		pointerTarget.y = ((event.clientY - box.top) / Math.min(box.height, window.innerHeight) - 0.5) * 2;
	};
	scene.addEventListener('pointermove', onPointerMove, { passive: true });
	const onScroll = (): void => {
		scrollTop = window.scrollY;
	};
	window.addEventListener('scroll', onScroll, { passive: true });

	const onSelect = (event: Event): void => {
		const app = (event as CustomEvent<{ id: string }>).detail?.id ?? '';
		story = { app, start: performance.now(), target: railTarget(app), nodes: nodes.filter((node) => node.shown && node.app === app) };
		start();
		if (!motionAllowed()) window.setTimeout(start, STORY_MS + 50);
	};
	document.addEventListener('workspace:select', onSelect);
	for (const node of nodes) {
		node.el.addEventListener('pointerenter', () => { hoverId = node.id; start(); });
		node.el.addEventListener('pointerleave', () => { hoverId = ''; start(); });
	}

	return () => {
		cancelAnimationFrame(frame);
		resize.disconnect();
		visibility.disconnect();
		motionToggle.disconnect();
		scene.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('scroll', onScroll);
		document.removeEventListener('visibilitychange', start);
		document.removeEventListener('workspace:select', onSelect);
	};
}
