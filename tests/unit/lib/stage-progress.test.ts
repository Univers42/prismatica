import { describe, expect, it } from 'vitest';
import { stageProgress } from '../../../src/lib/stage-progress';

// Three scenes stacked: 0–1000, 1000–3000, 3000–3800. Viewport 800, so the
// focus line sits at scrollY + 400 and each morph window is 2 × 280px wide.
const boxes = [
	{ top: 0, height: 1000 },
	{ top: 1000, height: 2000 },
	{ top: 3000, height: 800 },
];

describe('stageProgress', () => {
	it('holds the first scene at the top of the page', () => {
		expect(stageProgress(boxes, 0, 800)).toEqual({ from: 0, to: 0, t: 0 });
	});

	it('holds a scene while its middle is being read', () => {
		expect(stageProgress(boxes, 1600, 800)).toEqual({ from: 1, to: 1, t: 0 });
	});

	it('is half way through the morph when the focus line sits on a boundary', () => {
		expect(stageProgress(boxes, 600, 800)).toEqual({ from: 0, to: 1, t: 0.5 });
	});

	it('starts and ends the morph at the window edges', () => {
		expect(stageProgress(boxes, 600 - 280, 800).t).toBeCloseTo(0);
		expect(stageProgress(boxes, 600 + 279, 800).t).toBeCloseTo(279 / 560 + 0.5, 2);
	});

	it('holds the last scene past the end of the page', () => {
		expect(stageProgress(boxes, 9000, 800)).toEqual({ from: 2, to: 2, t: 0 });
	});

	it('narrows the window around a short section so morphs never overlap or jump', () => {
		// The middle scene is 400px: each window may only reach 200px into it.
		const short = [{ top: 0, height: 1000 }, { top: 1000, height: 400 }, { top: 1400, height: 1000 }];
		expect(stageProgress(short, 1199 - 400, 800).t).toBeCloseTo(1, 2);
		expect(stageProgress(short, 1199 - 400, 800)).toMatchObject({ from: 0, to: 1 });
		expect(stageProgress(short, 1200 - 400, 800)).toEqual({ from: 1, to: 2, t: 0 });
	});

	it('copes with no scenes', () => {
		expect(stageProgress([], 100, 800)).toEqual({ from: 0, to: 0, t: 0 });
	});
});
