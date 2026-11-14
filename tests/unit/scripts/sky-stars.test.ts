import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStarField } from '../../../src/scripts/sky-stars';
import { createMockContext } from '../helpers/canvas-mock';

describe('sky-stars nebula offscreen canvas', () => {
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

	it('should pre-render nebula to offscreen canvas and draw via drawImage with identity transform', () => {
		setupBufferMock();
		const { ctx: mockCtx, getGradientCount } = createMockContext();
		const stars = createStarField();
		stars.measure(1440, 900, 1.5);
		stars.draw(mockCtx, 16, true, { scroll: 100, pointer: { x: 0, y: 0 } });

		expect(getGradientCount()).toBe(0);
		expect((mockCtx as any).drawImageArgs).toBeDefined();
		const drawImageArgs = (mockCtx as any).drawImageArgs!;
		expect(drawImageArgs.length).toBeGreaterThanOrEqual(3);
		expect(drawImageArgs[0]).toBeTruthy();
		expect((mockCtx as any).transform).toEqual([1, 0, 0, 1, 0, 0]);
	});

	it('should not call createRadialGradient on main canvas during draw', () => {
		setupBufferMock();
		const { ctx: mockCtx, getGradientCount } = createMockContext();
		const stars = createStarField();
		stars.measure(1440, 900, 1);
		const gradientCountBefore = getGradientCount();
		stars.draw(mockCtx, 16, true, { scroll: 0, pointer: { x: 0, y: 0 } });
		const gradientCountAfter = getGradientCount();

		expect(gradientCountAfter - gradientCountBefore).toBe(0);
	});
});