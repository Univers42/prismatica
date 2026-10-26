// Pure maths for the hero sky (scripts/hero-universe.ts): seeded randomness so
// the star field is the same on every visit and after every resize, the slow
// drift each item follows, and points along the curves signals travel on.

export type Point = { x: number; y: number };

export type Drift = { radius: number; periodMs: number; phase: number };

/** mulberry32: a tiny seeded PRNG returning floats in [0, 1). */
export function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

/** Each item gets its own small orbit, so the sky never moves in lockstep. */
export function driftFor(index: number): Drift {
	const random = createRandom(index * 7919 + 17);
	return { radius: 5 + random() * 9, periodMs: 9000 + random() * 7000, phase: random() * Math.PI * 2 };
}

/** Offset from the item's resting place at `timeMs`; an ellipse, flatter than tall. */
export function driftOffset(drift: Drift, timeMs: number): Point {
	const angle = (timeMs / drift.periodMs) * Math.PI * 2 + drift.phase;
	return { x: Math.cos(angle) * drift.radius, y: Math.sin(angle) * drift.radius * 0.7 };
}

/** Quadratic Bézier from `from` to `to` bending through `control`, at t in [0, 1]. */
export function curvePoint(from: Point, control: Point, to: Point, t: number): Point {
	const inverse = 1 - t;
	return {
		x: inverse * inverse * from.x + 2 * inverse * t * control.x + t * t * to.x,
		y: inverse * inverse * from.y + 2 * inverse * t * control.y + t * t * to.y,
	};
}

export function easeInOut(t: number): number {
	return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** `#rrggbb` (what a canvas normalises an opaque colour to) at `alpha`; anything else falls back to the brand red. */
export function withAlpha(hex: string, alpha: number): string {
	const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
	const [r, g, b] = match ? [match[1], match[2], match[3]].map((part) => Number.parseInt(part!, 16)) : [228, dum, 43];
	return `rgba(${r},${g},${b},${alpha})`;
}
