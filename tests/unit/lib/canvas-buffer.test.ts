import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBuffer } from '../../../src/lib/canvas-buffer';

describe('canvas-buffer utility', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns an OffscreenBuffer with valid width and height', () => {
		const mockCtx = {} as CanvasRenderingContext2D;
		const origCreate = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			if (tag === 'canvas') {
				const el = origCreate('canvas');
				el.getContext = vi.fn().mockReturnValue(mockCtx);
				return el;
			}
			return origCreate(tag);
		});

		const buffer = createBuffer(200, 100);
		expect(buffer).not.toBeNull();
		expect(buffer!.canvas.width).toBe(200);
		expect(buffer!.canvas.height).toBe(100);
		expect(buffer!.ctx).toBe(mockCtx);
	});

	it('clamps minimum buffer dimensions to 1', () => {
		const mockCtx = {} as CanvasRenderingContext2D;
		const origCreate = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			if (tag === 'canvas') {
				const el = origCreate('canvas');
				el.getContext = vi.fn().mockReturnValue(mockCtx);
				return el;
			}
			return origCreate(tag);
		});

		const buffer = createBuffer(0, -5);
		expect(buffer).not.toBeNull();
		expect(buffer!.canvas.width).toBe(1);
		expect(buffer!.canvas.height).toBe(1);
	});

	it('returns null if 2d context is unavailable', () => {
		const origCreate = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			if (tag === 'canvas') {
				const el = origCreate('canvas');
				el.getContext = vi.fn().mockReturnValue(null);
				return el;
			}
			return origCreate(tag);
		});

		const buffer = createBuffer(100, 100);
		expect(buffer).toBeNull();
	});
});