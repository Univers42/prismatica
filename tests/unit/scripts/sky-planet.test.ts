import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlanet } from '../../../src/scripts/sky-planet';
import { createMockContext } from '../helpers/canvas-mock';

describe('sky-planet atmosphere offscreen canvas', () => {
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

	it('should pre-render corona and globe to offscreen canvas and draw via drawImage with identity transform', () => {
		setupBufferMock();
		const { ctx: mockCtx, getGradientCount } = createMockContext();
		const planet = createPlanet('default');
		planet.measure(1440, 600, 900, 1.5);
		planet.draw(mockCtx as unknown as CanvasRenderingContext2D, 16, true);

		expect(getGradientCount()).toBe(0);
		expect((mockCtx as any).drawImageArgs).toBeDefined();
		const drawImageArgs = (mockCtx as any).drawImageArgs!;
		expect(drawImageArgs.length).toBeGreaterThanOrEqual(3);
		expect(drawImageArgs[0]).toBeTruthy();
		expect((mockCtx as any).transform).toEqual([1, 0, 0, 1, 0, 0]);
	});

	it('should not call createRadialGradient or createLinearGradient on main canvas during draw', () => {
		setupBufferMock();
		const { ctx: mockCtx, getGradientCount } = createMockContext();
		const planet = createPlanet('default');
		planet.measure(1440, 600, 900, 1);
		const gradientCountBefore = getGradientCount();
		planet.draw(mockCtx as unknown as CanvasRenderingContext2D, 16, true);
		const gradientCountAfter = getGradientCount();

		expect(gradientCountAfter - gradientCountBefore).toBe(0);
	});
});