import { describe, expect, it } from 'vitest';
import { createStarField } from '../../../src/scripts/sky-stars';

describe('sky-stars nebula offscreen canvas', () => {
	function createMockContext() {
		let gradientId = 0;

		const ctx = {
			fillStyle: '',
			strokeStyle: '',
			globalAlpha: 1,
			lineWidth: 1,
			lineCap: 'butt',
			imageSmoothingEnabled: false,
			globalCompositeOperation: 'source-over' as const,
			shadowColor: '#000000',
			miterLimit: 10,
			lineDashOffset: 0,
			shadowOffsetX: 0,
			shadowOffsetY: 0,
			shadowBlur: 0,
			font: '',
			textBaseline: 'alphabetic' as const,
			textAlign: 'start' as const,
			canvas: {} as any,
			direction: 'ltr' as const,
			lang: '',

			createRadialGradient: function (_x0: number, _y0: number, _r0: number, _x1: number, _y1: number, _r1: number): any {
				gradientId++;
				const g: any = { id: gradientId, stops: [] };
				g.addColorStop = function (this: any, offset: number, color: string): void {
					this.stops.push({ offset, color });
				};
				return g;
			},

			createLinearGradient: function (_x0: number, _y0: number, _x1: number, _y1: number): any {
				gradientId++;
				const g: any = { id: gradientId, stops: [] };
				g.addColorStop = function (this: any, offset: number, color: string): void {
					this.stops.push({ offset, color });
				};
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

			setTransform: function (this: CanvasRenderingContext2D, ...args: any[]): void {
				;(ctx as any).transform = args;
			},

			resetTransform: function (this: CanvasRenderingContext2D): void {
				;(ctx as any).transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
			},
		};
		let callCount = 0;

		const reset = function (): void {
			callCount = 0;
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
			return gradientId;
		};

		const getCallCount = function (): number {
			return callCount;
		};

		return { ctx, reset, getGradientCount, getCallCount };
	}

	it('should pre-render nebula to offscreen canvas and draw via drawImage', () => {
		const { ctx: mockCtx, getGradientCount } = createMockContext();
		const starField = createStarField();
		starField.measure(1440, 900);
		starField.draw(mockCtx as unknown as CanvasRenderingContext2D, 16, true, { scroll: 100, pointer: { x: 0, y: 0 } });

		expect(getGradientCount()).toBe(0);
		expect((mockCtx as any).drawImageArgs).toBeDefined();
		const drawImageArgs = (mockCtx as any).drawImageArgs!;
		expect(drawImageArgs.length).toBeGreaterThanOrEqual(3);
		expect(drawImageArgs[0]).toBeTruthy();
		expect(drawImageArgs[2]).toBeGreaterThanOrEqual(0);
	});

	it('should not call createRadialGradient during draw', () => {
		const { ctx: mockCtx, getGradientCount } = createMockContext();
		const starField = createStarField();
		starField.measure(1440, 900);
		starField.draw(mockCtx as unknown as CanvasRenderingContext2D, 16, true, { scroll: 100, pointer: { x: 0, y: 0 } });

		const gradientCountBefore = getGradientCount();
		starField.draw(mockCtx as unknown as CanvasRenderingContext2D, 16, true, { scroll: 100, pointer: { x: 0, y: 0 } });
		const gradientCountAfter = getGradientCount();

		expect(gradientCountAfter - gradientCountBefore).toBe(0);
	});
});