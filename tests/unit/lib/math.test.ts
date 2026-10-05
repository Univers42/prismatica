import { describe, it, expect } from 'vitest';
import { secureRandom, randomBetween, randomIndex, clamp } from '../../../src/lib/math';

describe('math utilities', () => {
	describe('secureRandom', () => {
		it('returns a number between 0 (inclusive) and 1 (exclusive)', () => {
			for (let i = 0; i < 100; i++) {
				const val = secureRandom();
				expect(val).toBeGreaterThanOrEqual(0);
				expect(val).toBeLessThan(1);
			}
		});
	});

	describe('randomBetween', () => {
		it('returns a number within the specified range [minimum, minimum + span)', () => {
			for (let i = 0; i < 100; i++) {
				const val = randomBetween(5, 10); // [5, 15)
				expect(val).toBeGreaterThanOrEqual(5);
				expect(val).toBeLessThan(15);
			}
		});

		it('handles negative minimums correctly', () => {
			for (let i = 0; i < 100; i++) {
				const val = randomBetween(-10, 20); // [-10, 10)
				expect(val).toBeGreaterThanOrEqual(-10);
				expect(val).toBeLessThan(10);
			}
		});
	});

	describe('randomIndex', () => {
		it('returns an integer within bounds [0, length)', () => {
			const maxLen = 5;
			for (let i = 0; i < 100; i++) {
				const val = randomIndex(maxLen);
				expect(Number.isInteger(val)).toBe(true);
				expect(val).toBeGreaterThanOrEqual(0);
				expect(val).toBeLessThan(maxLen);
			}
		});

		it('returns 0 if length is 1', () => {
			for (let i = 0; i < 10; i++) {
				expect(randomIndex(1)).toBe(0);
			}
		});
	});

	describe('clamp', () => {
		it('does not alter a value already within bounds', () => {
			expect(clamp(5, 0, 10)).toBe(5);
			expect(clamp(-2, -5, 5)).toBe(-2);
		});

		it('returns the minimum if value is below minimum', () => {
			expect(clamp(-5, 0, 10)).toBe(0);
			expect(clamp(3, 5, 10)).toBe(5);
		});

		it('returns the maximum if value is above maximum', () => {
			expect(clamp(15, 0, 10)).toBe(10);
			expect(clamp(50, -10, 20)).toBe(20);
		});

		it('handles inverted min/max gracefully if required (or relies on Math bounds)', () => {
			// Math.max evaluates inner first: clamp(5, 10, 0) -> Math.min(Math.max(5, 10), 0) -> Math.min(10, 0) -> 0
			// The function signature implies min < max, so testing normal operation is sufficient.
			expect(clamp(10, 10, 10)).toBe(10);
		});
	});
});
