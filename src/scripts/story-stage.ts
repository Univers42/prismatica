// The page stage: one fixed canvas behind every home section, drawing the same
// pool of nodes in the shape of the section being read (lib/stage-scenes.ts).
// The stage stays put while the page scrolls over it; between two sections the
// nodes sweep from one shape into the next (lib/stage-progress.ts), the planet
// hub travels with them, and while a section is held small packets run along
// its edges like requests between services.
// Caveat: section boxes are measured on resize (of the viewport or of <main>).
// Content that moves without resizing <main> (a transform, a sticky panel)
// shifts the morph window by that much until the next measure.

import { motionAllowed } from '../lib/motion-preference';
import { isLand, sphereProjector, spherePoint, type Vec3 } from '../lib/sky-sphere';
import { stageProgress, type SceneBox } from '../lib/stage-progress';
import { SCENE_IDS, sceneLayout, stagePoolSize, type SceneId, type SceneLayout } from '../lib/stage-scenes';
import { createRandom, driftFor, driftOffset, easeInOut, type Drift, type Point } from '../lib/universe-motion';

type Scene = { id: SceneId; el: HTMLElement };
type Packet = { from: number; to: number; start: number; duration: number };
type Colors = { ink: string; signal: string };
/** The two scenes on screen, how far between them (0–1), and how strongly to draw. */
type Morph = { from: SceneLayout; to: SceneLayout; t: number; tone: number };

const PACKET_EVERY_MS = 520;
const MAX_PACKETS = 5;
const SPIN_PER_MS = 0.00012;
// Caveat: a pixel budget, not a measured limit. A faint backdrop loses little
// at 1.5x density and the canvas has ~44% fewer pixels to raster than at 2x.
const MAX_CANVAS_PIXELS = 4_000_000;
const MAX_DPR = 1.5;
// Caveat: a held scene redraws at ~30 fps. Drift, packets and the spinning hub
// are slow enough not to show it; a scroll or resize redraws on the next frame.
const IDLE_FRAME_MS = 33;
const ROLE_ALPHA = { dust: 0.22, node: 0.6, accent: 0.95 } as const;
const DRIFT_SCALE = { dust: 1, node: 0.3, accent: 0.18 } as const;
// Phones have no gutter, so the shape always sits behind the copy: there it is
// a watermark. Full strength mid-morph still crossed the section headlines.
const PHONE_TONE = 0.5;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

// Land dots on a unit sphere (Fibonacci spiral): the hub is a small planet.
function globeDots(count: number): Vec3[] {
	const golden = Math.PI * (3 - Math.sqrt(5));
	return Array.from({ length: count }, (_, index) => {
		const y = 1 - (2 * (index + 0.5)) / count;
		return spherePoint(Math.asin(y), index * golden);
	}).filter((point) => isLand(point));
}

function probeColors(ctx: CanvasRenderingContext2D): Colors {
	const style = getComputedStyle(document.documentElement);
	const read = (name: string, fallback: string): string => {
		ctx.fillStyle = fallback;
		ctx.fillStyle = style.getPropertyValue(name).trim() || fallback;
		return String(ctx.fillStyle);
	};
	return { ink: read('--brand-canvas-text', '#111111'), signal: read('--brand-palette-primary', '#e4002b') };
}

export function bindStoryStage(canvas: HTMLCanvasElement, main: HTMLElement): (() => void) | null {
	const context = canvas.getContext('2d');
	const scenes: Scene[] = [...main.querySelectorAll<HTMLElement>('[data-stage]')]
		.map((el) => ({ id: el.dataset.stage as SceneId, el }))
		.filter((scene) => SCENE_IDS.includes(scene.id));
	if (!context || scenes.length < 2) return null;
	const ctx = context;
	const globe = globeDots(520);
	const random = createRandom(29);
	let colors = probeColors(ctx);
	let layouts: SceneLayout[] = [];
	let drifts: Drift[] = [];
	let boxes: SceneBox[] = [];
	let packets: Packet[] = [];
	let lastPacketAt = 0;
	let width = 0;
	let height = 0;
	let frame = 0;
	let lastDrawAt = 0;
	let dirty = true;
	let scrollTop = window.scrollY;
	const positions: Point[] = [];

	function measureCanvas(): void {
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height)));
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		const count = stagePoolSize(width);
		layouts = scenes.map((scene) => sceneLayout(scene.id, width, height, count));
		drifts = Array.from({ length: count }, (_, index) => driftFor(index));
		packets = [];
	}

	function measureScenes(): void {
		boxes = scenes.map(({ el }) => ({ top: el.getBoundingClientRect().top + window.scrollY, height: el.offsetHeight }));
	}

	// Nodes leave in angular order (the pool is sorted by angle), so a morph
	// sweeps round the stage instead of every node jumping at once.
	function placeNodes({ from, to, t }: Morph, now: number, moving: boolean): void {
		const count = from.nodes.length;
		for (let index = 0; index < count; index += 1) {
			const a = from.nodes[index]!;
			const b = to.nodes[index]!;
			const local = moving ? easeInOut(clamp01((t - (0.3 * index) / count) / 0.7)) : t;
			const role = local < 0.5 ? a.role : b.role;
			const offset = moving ? driftOffset(drifts[index]!, now) : { x: 0, y: 0 };
			positions[index] = {
				x: mix(a.x, b.x, local) + offset.x * DRIFT_SCALE[role],
				y: mix(a.y, b.y, local) + offset.y * DRIFT_SCALE[role],
			};
		}
	}

	function drawEdges(layout: SceneLayout, alpha: number): void {
		if (alpha <= 0.01 || layout.edges.length === 0) return;
		ctx.globalAlpha = alpha * 0.2;
		ctx.strokeStyle = colors.ink;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (const [a, b] of layout.edges) {
			ctx.moveTo(positions[a]!.x, positions[a]!.y);
			ctx.lineTo(positions[b]!.x, positions[b]!.y);
		}
		ctx.stroke();
	}

	function drawSpokes(layout: SceneLayout, hub: SceneLayout['hub'], alpha: number): void {
		if (alpha <= 0.01) return;
		ctx.globalAlpha = alpha * 0.22;
		ctx.strokeStyle = colors.signal;
		ctx.setLineDash([2, 5]);
		ctx.beginPath();
		for (const index of layout.spokes) {
			const end = positions[index]!;
			const angle = Math.atan2(end.y - hub.y, end.x - hub.x);
			ctx.moveTo(hub.x + Math.cos(angle) * hub.r, hub.y + Math.sin(angle) * hub.r);
			ctx.lineTo(end.x, end.y);
		}
		ctx.stroke();
		ctx.setLineDash([]);
	}

	function drawNodes({ from, to, t, tone }: Morph): void {
		for (let index = 0; index < positions.length; index += 1) {
			const a = from.nodes[index]!;
			const b = to.nodes[index]!;
			const role = t < 0.5 ? a.role : b.role;
			const point = positions[index]!;
			ctx.globalAlpha = mix(ROLE_ALPHA[a.role], ROLE_ALPHA[b.role], t) * tone;
			ctx.fillStyle = role === 'accent' ? colors.signal : colors.ink;
			ctx.beginPath();
			ctx.arc(point.x, point.y, mix(a.size, b.size, t), 0, Math.PI * 2);
			ctx.fill();
			if (role !== 'accent') continue;
			ctx.globalAlpha *= 0.35;
			ctx.strokeStyle = colors.signal;
			ctx.beginPath();
			ctx.arc(point.x, point.y, mix(a.size, b.size, t) * 2.4, 0, Math.PI * 2);
			ctx.stroke();
		}
	}

	function drawHub(hub: SceneLayout['hub'], tone: number, now: number): void {
		const project = sphereProjector(now * SPIN_PER_MS, -0.45, hub.r);
		const out: Vec3 = { x: 0, y: 0, z: 0 };
		const dot = Math.max(0.8, Math.min(1.8, hub.r / 36));
		ctx.fillStyle = colors.ink;
		for (const point of globe) {
			project(point, out);
			if (out.z <= 0.05) continue;
			ctx.globalAlpha = (0.12 + out.z * 0.45) * tone;
			ctx.fillRect(hub.x + out.x - dot / 2, hub.y + out.y - dot / 2, dot, dot);
		}
		ctx.globalAlpha = 0.28 * tone;
		ctx.strokeStyle = colors.ink;
		ctx.beginPath();
		ctx.arc(hub.x, hub.y, hub.r, 0, Math.PI * 2);
		ctx.stroke();
	}

	function drawPackets(layout: SceneLayout, tone: number, now: number): void {
		if (now - lastPacketAt > PACKET_EVERY_MS && packets.length < MAX_PACKETS && layout.edges.length > 0) {
			const [a, b] = layout.edges[Math.floor(random() * layout.edges.length)]!;
			const forward = random() > 0.5;
			packets.push({ from: forward ? a : b, to: forward ? b : a, start: now, duration: 900 + random() * 700 });
			lastPacketAt = now;
		}
		packets = packets.filter((packet) => now - packet.start < packet.duration);
		ctx.fillStyle = colors.signal;
		for (const packet of packets) {
			const t = easeInOut((now - packet.start) / packet.duration);
			const from = positions[packet.from]!;
			const to = positions[packet.to]!;
			ctx.globalAlpha = Math.sin(Math.PI * t) * tone;
			ctx.beginPath();
			ctx.arc(mix(from.x, to.x, t), mix(from.y, to.y, t), 2.2, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// Returns whether the frame needs a successor: the stage is on screen and moving.
	function draw(now: number, moving: boolean): boolean {
		ctx.clearRect(0, 0, width, height);
		const progress = stageProgress(boxes, scrollTop, height);
		// The hero has its own sky and covers the stage until it scrolls away.
		if (progress.to === 0 || layouts.length === 0) return false;
		const from = layouts[progress.from]!;
		const to = layouts[progress.to]!;
		const t = moving ? progress.t : Math.round(progress.t);
		const morph: Morph = { from, to, t, tone: mix(from.intensity, to.intensity, t) * (width < 1024 ? PHONE_TONE : 1) };
		placeNodes(morph, now, moving);
		const travel = easeInOut(t);
		const hub = { x: mix(from.hub.x, to.hub.x, travel), y: mix(from.hub.y, to.hub.y, travel), r: mix(from.hub.r, to.hub.r, travel) };
		const outgoing = (1 - clamp01(t / 0.45)) * morph.tone;
		const incoming = clamp01((t - 0.55) / 0.45) * morph.tone;
		drawHub(hub, morph.tone, moving ? now : 0);
		drawEdges(from, outgoing);
		drawEdges(to, incoming);
		drawSpokes(from, hub, outgoing);
		drawSpokes(to, hub, incoming);
		drawNodes(morph);
		if (moving && progress.from === progress.to) drawPackets(to, morph.tone, now);
		ctx.globalAlpha = 1;
		return moving;
	}

	const loop = (now: number): void => {
		frame = 0;
		const moving = motionAllowed();
		if (moving && !dirty && now - lastDrawAt < IDLE_FRAME_MS) {
			frame = requestAnimationFrame(loop);
			return;
		}
		dirty = false;
		lastDrawAt = now;
		if (draw(now, moving) && !document.hidden) frame = requestAnimationFrame(loop);
	};
	const start = (): void => {
		dirty = true;
		if (!frame) frame = requestAnimationFrame(loop);
	};

	const onScroll = (): void => {
		scrollTop = window.scrollY;
		start();
	};
	const viewport = new ResizeObserver(() => {
		measureCanvas();
		measureScenes();
		start();
	});
	viewport.observe(canvas);
	const content = new ResizeObserver(() => {
		measureScenes();
		start();
	});
	content.observe(main);
	// Theme switches change the palette; the pause button changes the class.
	const themeWatch = new MutationObserver(() => {
		colors = probeColors(ctx);
		start();
	});
	themeWatch.observe(document.documentElement, { attributeFilter: ['class', 'data-theme'] });
	window.addEventListener('scroll', onScroll, { passive: true });
	document.addEventListener('visibilitychange', start);
	main.dataset.stageReady = '';

	return () => {
		cancelAnimationFrame(frame);
		viewport.disconnect();
		content.disconnect();
		themeWatch.disconnect();
		window.removeEventListener('scroll', onScroll);
		document.removeEventListener('visibilitychange', start);
		delete main.dataset.stageReady;
	};
}
