import { describe, expect, it } from 'vitest';
import { createStarField } from '../../../src/scripts/sky-stars';
import { createPlanet } from '../../../src/scripts/sky-planet';

describe('hero canvas benchmark', () => {
	function createMockContext() {
		const gradients: Map<number, any> = new Map();
		let gradientId = 0;

		const ctx: CanvasRenderingContext2D = {
			fillStyle: '',
			strokeStyle: '',
			globalAlpha: 1,
			lineWidth: 1,
			lineCap: 'butt',

			createRadialGradient: function (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): any {
				gradientId++;
				const g: any = { id: gradientId, stops: [] };
				g.addColorStop = function(this: any, offset: number, color: string): void {
					this.stops.push({ offset, color });
				};
				gradients.set(g.id, g);
				return g;
			},

			createLinearGradient: function (x0: number, y0: number, x1: number, y1: number): any {
				gradientId++;
				const g: any = { id: gradientId, stops: [] };
				g.addColorStop = function(this: any, offset: number, color: string): void {
					this.stops.push({ offset, color });
				};
				gradients.set(g.id, g);
				return g;
			},

			fillRect: function (x: number, y: number, w: number, h: number): void {
				;(ctx as any).lastFillRect = { x, y, w, h };
			},

			stroke: function (this: CanvasRenderingContext2D): void {
				;(ctx as any).strokeCount = (ctx as any).strokeCount ? (ctx as any).strokeCount + 1 : 1;
			},

			fill: function (this: CanvasRenderingContext2D): void {
				;(ctx as any).fillCount = (ctx as any).fillCount ? (ctx as any).fillCount + 1 : 1;
			},

			drawImage: function (this: CanvasRenderingContext2D, ...args: any[]): void {
				;(ctx as any).drawImageArgs = args;
			},

			save: function (this: CanvasRenderingContext2D): void {
				;(ctx as any).saveCount = (ctx as any).saveCount ? (ctx as any).saveCount + 1 : 1;
			},

			restore: function (this: CanvasRenderingContext2D): void {
				;(ctx as any).restoreCount = (ctx as any).restoreCount ? (ctx as any).restoreCount + 1 : 1;
			},

			scale: function (this: CanvasRenderingContext2D, sx: number, sy: number): void {
				;(ctx as any).scaleSx = sx;
				;(ctx as any).scaleSy = sy;
			},

			translate: function (this: CanvasRenderingContext2D, tx: number, ty: number): void {
				;(ctx as any).translateTx = tx;
				;(ctx as any).translateTy = ty;
			},

			beginPath: function (this: CanvasRenderingContext2D): void {
				;(ctx as any).beginPathCount = (ctx as any).beginPathCount ? (ctx as any).beginPathCount + 1 : 1;
			},

			moveTo: function (this: CanvasRenderingContext2D, x: number, y: number): void {
				;(ctx as any).lastMoveTo = { x, y };
			},

			lineTo: function (this: CanvasRenderingContext2D, x: number, y: number): void {
				;(ctx as any).lastLineTo = { x, y };
			},

			arc: function (this: CanvasRenderingContext2D, x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
				;(ctx as any).lastArc = { x, y, radius, startAngle, endAngle };
			},

			rect: function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
				;(ctx as any).lastRect = { x, y, w, h };
			},

			setTransform: function (this: CanvasRenderingContext2D, a: number, b: number, c: number, d: number, e: number, f: number): void {
				;(ctx as any).transform = { a, b, c, d, e, f };
			},

			resetTransform: function (this: CanvasRenderingContext2D): void {
				;(ctx as any).transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
			},
		};

		let callCount = 0;

		const reset = function (): void {
			callCount = 0;
			gradients.clear();
			;(ctx as any).saveCount = 0;
			;(ctx as any).restoreCount = 0;
			;(ctx as any).strokeCount = 0;
			;(ctx as any).fillCount = 0;
			;(ctx as any).fillStyle = '';
			;(ctx as any).strokeStyle = '';
			;(ctx as any).globalAlpha = 1;
			;(ctx as any).lineWidth = 1;
			;(ctx as any).lineCap = 'butt';
			;(ctx as any).lastFillRect = null;
			;(ctx as any).lastMoveTo = null;
			;(ctx as any).lastLineTo = null;
			;(ctx as any).lastArc = null;
			;(ctx as any).lastRect = null;
			;(ctx as any).transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
			;(ctx as any).drawImageArgs = null;
		};

		const getGradientCount = function (): number {
			return gradients.size;
		};

		const getCallCount = function (): number {
			return callCount;
		};

		return { ctx, reset, getGradientCount, getCallCount };
	}

	it('starField benchmark', () => {
		const { ctx: mockCtx, reset, getGradientCount } = createMockContext();
		const starField = createStarField();
		starField.measure(1440, 900);

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

		expect(avgGradients).toBeGreaterThanOrEqual(7);
		expect(avgTime).toBeGreaterThan(0);
	});

	it('planet benchmark', () => {
		const { ctx: mockCtx, reset, getGradientCount } = createMockContext();
		const planet = createPlanet('default');
		planet.measure(1440, 600, 900);

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

		expect(avgGradients).toBeGreaterThanOrEqual(4);
		expect(avgTime).toBeGreaterThan(0);
	});
});