// The shapes the page stage takes, one per home section, all built from the
// same pool of nodes so the stage can morph one into the next: stars in the
// hero, then the six linked apps, the three features, the canvas windows, the
// services as a honeycomb (grobase's hexagonal architecture), people, pricing
// tiers, lines of code, an orbit for questions, and the binocular to close.
// Pure and seeded: the same size always gives the same sky.

import { createRandom, type Point } from './universe-motion';
import { columns, honeycomb, mergeShapes, rectangle, ring, rows, type Edge, type Shape } from './stage-shapes';

export const SCENE_IDS = ['hero', 'apps', 'product', 'canvas', 'architecture', 'proof', 'pricing', 'docs', 'faq', 'cta'] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export interface StageNode {
	x: number;
	y: number;
	size: number;
	role: 'node' | 'accent' | 'dust';
}

export interface SceneLayout {
	nodes: StageNode[];
	edges: Edge[];
	/** Nodes joined to the planet hub. */
	spokes: number[];
	hub: { x: number; y: number; r: number };
	/** How strongly the scene draws over its section: lower where the section has its own figure. */
	intensity: number;
}

interface Frame {
	width: number;
	height: number;
	centre: Point;
	/** Radius unit: shapes are sized in multiples of it so they fit any screen. */
	unit: number;
}

type Built = { shape: Shape; hub: SceneLayout['hub']; intensity: number };

/** More nodes on wider screens; phones keep enough for the largest shape. */
export function stagePoolSize(width: number): number {
	return width >= 1024 ? 72 : 48;
}

const at = (frame: Frame, dx: number, dy: number): Point => ({ x: frame.centre.x + dx * frame.unit, y: frame.centre.y + dy * frame.unit });

function clusters(frame: Frame, count: number, spread: number, size: number, startAngle: number): Shape {
	const parts = Array.from({ length: count }, (_, index) => {
		const angle = startAngle + (index / count) * Math.PI * 2;
		const centre = at(frame, Math.cos(angle) * spread, Math.sin(angle) * spread);
		const cluster = ring(centre, size * frame.unit, 6);
		return mergeShapes(cluster, { points: [centre], edges: [], accents: [0] });
	});
	return mergeShapes(...parts);
}

function appsScene(frame: Frame): Built {
	const apps = ring(frame.centre, frame.unit * 0.62, 6);
	apps.accents = apps.points.map((_, index) => index);
	// Each app fans out to four records of its own, facing away from the hub.
	const satellites = apps.points.map((app): Shape => ({
		...ring(app, frame.unit * 0.16, 4, Math.atan2(app.y - frame.centre.y, app.x - frame.centre.x)),
		edges: [],
	}));
	const merged = mergeShapes(apps, ...satellites);
	apps.points.forEach((_, app) => {
		for (let satellite = 0; satellite < 4; satellite += 1) merged.edges.push([app, 6 + app * 4 + satellite]);
	});
	return { shape: merged, hub: { ...frame.centre, r: frame.unit * 0.2 }, intensity: 0.9 };
}

function builders(frame: Frame): Record<SceneId, () => Built> {
	const { width, height, unit } = frame;
	return {
		hero: () => ({ shape: { points: [], edges: [], accents: [] }, hub: { x: width / 2, y: height + Math.max(width * 0.9, 600) * 0.82, r: Math.max(width * 0.9, 600) }, intensity: 1 }),
		apps: () => appsScene(frame),
		product: () => {
			const shape = clusters(frame, 3, 0.55, 0.14, -Math.PI / 2);
			shape.edges.push([6, 13], [13, 20], [20, 6]);
			return { shape, hub: { ...frame.centre, r: unit * 0.14 }, intensity: 0.8 };
		},
		canvas: () => ({
			shape: mergeShapes(
				rectangle(at(frame, -0.75, -0.55), unit * 1.05, unit * 0.7, 3),
				rectangle(at(frame, -0.35, -0.2), unit * 1.05, unit * 0.7, 3),
				rectangle(at(frame, -0.55, 0.2), unit * 0.8, unit * 0.5, 3),
			),
			hub: { ...at(frame, 0.95, -0.75), r: unit * 0.12 },
			intensity: 0.6,
		}),
		architecture: () => ({ shape: honeycomb(frame.centre, unit * 0.26), hub: { ...frame.centre, r: unit * 0.17 }, intensity: 0.45 }),
		proof: () => ({ shape: clusters(frame, 3, 0.6, 0.14, Math.PI / 6), hub: { ...at(frame, -0.9, 0.7), r: unit * 0.12 }, intensity: 0.8 }),
		pricing: () => ({ shape: columns(at(frame, -0.45, 0.5), [4, 6, 9], unit * 0.12, unit * 0.45), hub: { ...at(frame, 0.8, -0.8), r: unit * 0.1 }, intensity: 0.6 }),
		docs: () => ({
			shape: rows(at(frame, -0.5, -0.45), [5, 8, 6, 3, 7, 4, 6], [0, 1, 2, 2, 1, 1, 0], unit * 0.1, unit * 0.14),
			hub: { ...at(frame, -0.85, -0.8), r: unit * 0.1 },
			intensity: 0.7,
		}),
		faq: () => ({ shape: mergeShapes(ring(frame.centre, unit * 0.5, 12), ring(frame.centre, unit * 0.8, 18)), hub: { ...frame.centre, r: unit * 0.26 }, intensity: 0.9 }),
		cta: () => {
			const lenses = mergeShapes(ring(at(frame, -0.32, 0), unit * 0.38, 16), ring(at(frame, 0.32, 0), unit * 0.38, 16), { points: [at(frame, -0.32, 0), at(frame, 0.32, 0)], edges: [], accents: [0, 1] });
			return { shape: lenses, hub: { ...frame.centre, r: unit * 0.08 }, intensity: 1 };
		},
	};
}

// Nodes are ordered by angle round the stage centre in every scene, so node k
// sweeps round to its next place instead of cutting across the whole screen.
function orderByAngle(nodes: StageNode[], centre: Point): number[] {
	const angle = (node: StageNode) => Math.atan2(node.y - centre.y, node.x - centre.x);
	return nodes.map((_, index) => index).sort((a, b) => angle(nodes[a]!) - angle(nodes[b]!));
}

export function sceneLayout(id: SceneId, width: number, height: number, count: number): SceneLayout {
	const wide = width >= 1024;
	const frame: Frame = {
		width,
		height,
		centre: { x: width * (wide ? 0.64 : 0.5), y: height * 0.55 },
		unit: Math.min(width, height) * 0.42,
	};
	const { shape, hub, intensity } = builders(frame)[id]();
	const base = Math.min(Math.max(Math.min(width, height) / 300, 1.5), 3);
	const accents = new Set(shape.accents);
	const structural = shape.points.slice(0, count).map((point, index): StageNode => ({
		...point,
		size: accents.has(index) ? base * 2.4 : base * 1.5,
		role: accents.has(index) ? 'accent' : 'node',
	}));
	const random = createRandom(SCENE_IDS.indexOf(id) * 131 + 7);
	const dust = Array.from({ length: count - structural.length }, (): StageNode => ({
		x: random() * width,
		y: random() * height,
		size: base * (0.4 + random() * 0.45),
		role: 'dust',
	}));
	const unordered = [...structural, ...dust];
	const order = orderByAngle(unordered, frame.centre);
	const placeOf = new Map(order.map((oldIndex, newIndex) => [oldIndex, newIndex]));
	const remap = (index: number) => placeOf.get(index)!;
	const keep = (index: number) => index < structural.length;
	return {
		nodes: order.map((oldIndex) => unordered[oldIndex]!),
		edges: shape.edges.filter(([a, b]) => keep(a) && keep(b)).map(([a, b]): Edge => [remap(a), remap(b)]),
		spokes: shape.accents.filter(keep).map(remap),
		hub,
		intensity,
	};
}
