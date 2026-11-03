import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindHeroUniverse, IDLE_FRAME_MS, MAX_DPR, MAX_CANVAS_PIXELS } from '../../../src/scripts/hero-universe';

describe('hero universe frame throttling and DPR clamp', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	it('has correct IDLE_FRAME_MS', () => {
		expect(IDLE_FRAME_MS).toBe(33);
	});

	it('has correct MAX_DPR', () => {
		expect(MAX_DPR).toBe(1.5);
	});

	it('has correct MAX_CANVAS_PIXELS', () => {
		expect(MAX_CANVAS_PIXELS).toBe(4_000_000);
	});

	it('bindHeroUniverse returns a cleanup function', () => {
		const root = document.createElement('div');
		root.innerHTML = `
			<canvas data-universe-canvas></canvas>
			<div data-universe-node class="uv-node"><div class="uv-node__mark"></div></div>
		`;
		document.body.appendChild(root);

		// Stub getContext to return a mock context
		const canvas = root.querySelector('canvas')!;
		(canvas as any).getContext = vi.fn().mockReturnValue(
			/** @type {CanvasRenderingContext2D} */ (({
				fillStyle: '#e4002b',
				save: () => {},
				restore: () => {},
				clearRect: () => {},
				fillRect: () => {},
				beginPath: () => {},
				moveTo: () => {},
				lineTo: () => {},
				stroke: () => {},
				arc: () => {},
				fill: () => {},
				createLinearGradient: () => {},
				addColorStop: () => {},
				setTransform: () => {},
				globalAlpha: 1,
				lineWidth: 1,
				strokeStyle: '#e4002b',
				font: '' as string,
				textAlign: 'center' as const,
			} as const))
		);

		const cleanup = bindHeroUniverse(root as HTMLElement);
		expect(cleanup).toBeInstanceOf(Function);

		(cleanup as (() => void))();
	});
});
