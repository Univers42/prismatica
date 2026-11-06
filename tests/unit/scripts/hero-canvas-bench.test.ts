import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStarField } from '../../../src/scripts/sky-stars';
import { createPlanet } from '../../../src/scripts/sky-planet';
import { createMockContext } from '../helpers/canvas-mock';

describe('hero canvas benchmark', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function setupBufferMock() {
		const bufferCtx = createMockContext().ctx;
		const origCreate = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			if (tag === 'canvas') {
				const el = origCreate('canvas');
				el.getContext = vi.fn().mockReturnValue(bufferCtx);
				return el;
			}
			return origCreate(tag);
		});
		return bufferCtx;
	}

	it('starField benchmark', () => {
		setupBufferMock();
		const { ctx: mockCtx, reset, getGradientCount } = createMockContext();
		const starField = createStarField();
		starField.measure(1440, 900, 1.5);

		const iterations = 50;
		const gradientCounts: number[] = [];
		const times: number[] = [];

		for (let i = 0; i < iterations; i++) {
			reset();
			const start = performance.now();
			starField.draw(mockCtx, 16, true, { scroll: 0, pointer: { x: 0, y: 0 } });
			const end = performance.now();
			const elapsed = end - start;
			times.push(elapsed);
			gradientCounts.push(getGradientCount());
		}

		const totalTime = times.reduce((a: number, b: number) => a + b, 0);
		const avgTime = totalTime / iterations;
		const avgGradients = gradientCounts.reduce((a: number, b: number) => a + b, 0) / iterations;

		console.info(`[Hero Canvas Benchmark Baseline] Stars: ${avgTime.toFixed(2)} ms/frame, ${avgGradients.toFixed(1)} gradients/frame`);

		expect(avgGradients).toBe(0);
		expect(avgTime).toBeGreaterThan(0);
	});

	it('planet benchmark', () => {
		setupBufferMock();
		const { ctx: mockCtx, reset, getGradientCount } = createMockContext();
		const planet = createPlanet('default');
		planet.measure(1440, 600, 900, 1.5);

		const iterations = 50;
		const gradientCounts: number[] = [];
		const times: number[] = [];

		for (let i = 0; i < iterations; i++) {
			reset();
			const start = performance.now();
			planet.draw(mockCtx, 16, true);
			const end = performance.now();
			const elapsed = end - start;
			times.push(elapsed);
			gradientCounts.push(getGradientCount());
		}

		const totalTime = times.reduce((a: number, b: number) => a + b, 0);
		const avgTime = totalTime / iterations;
		const avgGradients = gradientCounts.reduce((a: number, b: number) => a + b, 0) / iterations;

		console.info(`[Hero Canvas Benchmark Baseline] Planet: ${avgTime.toFixed(2)} ms/frame, ${avgGradients.toFixed(1)} gradients/frame`);

		expect(avgGradients).toBe(0);
		expect(avgTime).toBeGreaterThan(0);
	});
});