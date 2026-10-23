import { describe, it, expect } from 'vitest';
import { nextLean } from '../../../src/lib/scroll-lean';

describe('nextLean', () => {
	it('clamps the lean at ±7 deg', () => {
		expect(nextLean(0, 10_000, 4_000)).toBeCloseTo(7, 5);
		expect(nextLean(0, -10_000, 4_000)).toBeCloseTo(-7, 5);
		expect(nextLean(7, 10_000, 4_000)).toBeLessThanOrEqual(7);
		expect(nextLean(-7, -10_000, 4_000)).toBeGreaterThanOrEqual(-7);
	});

	it('eases back toward 0 when the velocity is 0', () => {
		const settled = nextLean(5, 0, 130);
		expect(settled).toBeGreaterThan(0);
		expect(settled).toBeLessThan(5);
	});

	it('follows the sign of the velocity', () => {
		expect(nextLean(0, -200, 16)).toBeLessThan(0);
		expect(nextLean(0, 200, 16)).toBeGreaterThan(0);
	});

	it('returns the current lean for a zero dt', () => {
		expect(nextLean(3.5, 250, 0)).toBe(3.5);
	});
});
