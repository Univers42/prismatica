import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyNodeTransform, bindHeroUniverse, IDLE_FRAME_MS, MAX_DPR, MAX_CANVAS_PIXELS } from '../../../src/scripts/hero-universe';

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

	it('applyNodeTransform avoids redundant style.transform updates when position has not changed', () => {
		const el = document.createElement('div');
		const node: { el: HTMLElement; lastTransform?: string } = { el };

		// First apply: should update style.transform and return true
		const changed1 = applyNodeTransform(node, 10.2, 5.4);
		expect(changed1).toBe(true);
		expect(el.style.transform).toBe('translate(-50%, -50%) translate(10.2px, 5.4px)');
		expect(node.lastTransform).toBe('translate(-50%, -50%) translate(10.2px, 5.4px)');

		// Second apply with identical coordinates: should skip update and return false
		const changed2 = applyNodeTransform(node, 10.2, 5.4);
		expect(changed2).toBe(false);

		// Third apply with subpixel difference rounding to the same toFixed(1): should skip update
		const changed3 = applyNodeTransform(node, 10.21, 5.42);
		expect(changed3).toBe(false);

		// Fourth apply with distinct coordinate: should update style.transform and return true
		const changed4 = applyNodeTransform(node, 12.0, 5.4);
		expect(changed4).toBe(true);
		expect(el.style.transform).toBe('translate(-50%, -50%) translate(12.0px, 5.4px)');
		expect(node.lastTransform).toBe('translate(-50%, -50%) translate(12.0px, 5.4px)');
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
