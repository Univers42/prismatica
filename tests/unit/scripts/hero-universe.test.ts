import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyNodeTransform, bindHeroUniverse, IDLE_FRAME_MS, MAX_DPR, MAX_CANVAS_PIXELS } from '../../../src/scripts/hero-universe';
import { createMockContext } from '../helpers/canvas-mock';

describe('hero universe frame throttling and DPR clamp', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = '';
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = '';
		document.documentElement.classList.remove('motion-paused');
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

	it('does not ease pointer when motion is not allowed', () => {
		document.documentElement.classList.add('motion-paused');
		const root = document.createElement('div');
		root.innerHTML = `
			<div data-universe-scene>
				<canvas data-universe-canvas></canvas>
				<div data-universe-node class="uv-node"><div class="uv-node__mark"></div></div>
			</div>
		`;
		document.body.appendChild(root);

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

		// Trigger initial render via visibilitychange
		document.dispatchEvent(new Event('visibilitychange'));
		vi.advanceTimersByTime(16);

		const nodeEl = root.querySelector('[data-universe-node]') as HTMLElement;
		// Initial frame drawn with pointer = (0, 0)
		expect(nodeEl.style.transform).toBe('translate(-50%, -50%) translate(0.0px, 0.0px)');

		// Pointermove should be ignored when motion is paused
		const scene = root.querySelector('[data-universe-scene]')!;
		scene.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 300, pointerType: 'mouse' }));
		vi.advanceTimersByTime(50);

		// Transform must remain unchanged at (0.0px, 0.0px)
		expect(nodeEl.style.transform).toBe('translate(-50%, -50%) translate(0.0px, 0.0px)');

		(cleanup as (() => void))();
		document.documentElement.classList.remove('motion-paused');
	});

	it('suppresses scroll start when motion is not allowed', () => {
		document.documentElement.classList.add('motion-paused');
		const root = document.createElement('div');
		root.innerHTML = `
			<div data-universe-scene>
				<canvas data-universe-canvas></canvas>
				<div data-universe-node class="uv-node"><div class="uv-node__mark"></div></div>
			</div>
		`;
		document.body.appendChild(root);

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

		// Trigger initial frame
		document.dispatchEvent(new Event('visibilitychange'));
		vi.advanceTimersByTime(16);

		const nodeEl = root.querySelector('[data-universe-node]') as HTMLElement;
		expect(nodeEl.style.transform).toBe('translate(-50%, -50%) translate(0.0px, 0.0px)');

		// Scroll event should be suppressed when motion is paused
		window.dispatchEvent(new Event('scroll'));
		vi.advanceTimersByTime(50);

		// Transform must remain unchanged
		expect(nodeEl.style.transform).toBe('translate(-50%, -50%) translate(0.0px, 0.0px)');

		(cleanup as (() => void))();
		document.documentElement.classList.remove('motion-paused');
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