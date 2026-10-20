import { describe, expect, it } from 'vitest';
import { createRandom, curvePoint, driftFor, driftOffset, easeInOut, withAlpha } from '../../../src/lib/universe-motion';

describe('universe motion maths', () => {
	it('repeats the same sequence for the same seed, inside [0, 1)', () => {
		const first = createRandom(42);
		const second = createRandom(42);
		for (let index = 0; index < 500; index += 1) {
			const value = first();
			expect(value).toBe(second());
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
		expect(createRandom(43)()).not.toBe(createRandom(42)());
	});

	it('keeps every drift inside its radius and loops on its period', () => {
		for (let index = 0; index < 12; index += 1) {
			const drift = driftFor(index);
			for (let time = 0; time < drift.periodMs; time += 250) {
				const offset = driftOffset(drift, time);
				expect(Math.hypot(offset.x, offset.y)).toBeLessThanOrEqual(drift.radius + 1e-9);
			}
			const start = driftOffset(drift, 0);
			const loop = driftOffset(drift, drift.periodMs);
			expect(loop.x).toBeCloseTo(start.x, 6);
			expect(loop.y).toBeCloseTo(start.y, 6);
		}
	});

	it('starts and ends curves on their endpoints', () => {
		const from = { x: 0, y: 0 };
		const control = { x: 50, y: 100 };
		const to = { x: 100, y: 0 };
		expect(curvePoint(from, control, to, 0)).toEqual(from);
		expect(curvePoint(from, control, to, 1)).toEqual(to);
		expect(curvePoint(from, control, to, 0.5)).toEqual({ x: 50, y: 50 });
	});

	it('eases from 0 to 1 through the midpoint', () => {
		expect(easeInOut(0)).toBe(0);
		expect(easeInOut(0.5)).toBe(0.5);
		expect(easeInOut(1)).toBe(1);
	});
});

describe('withAlpha', () => {
	it('turns a hex colour into rgba at the given alpha', () => {
		expect(withAlpha('#e4002b', 0.5)).toBe('rgba(228,0,43,0.5)');
		expect(withAlpha('  #FFFFFF ', 1)).toBe('rgba(255,255,255,1)');
	});

	it('falls back to the brand red for a colour it cannot read', () => {
		expect(withAlpha('oklch(60% 0.2 25)', 0.2)).toBe('rgba(228,0,43,0.2)');
	});
});
