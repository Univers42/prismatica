import { describe, expect, it } from 'vitest';
import { captureSize, ratioClass, resolveMediaSlot } from '../../../src/lib/media-slot';
import type { MediaShot } from '../../../src/data/media-shots';

const video: MediaShot = {
	id: 'board',
	kind: 'video',
	ratio: '16/10',
	label: 'Cards dragged across a board',
	capture: 'Drag two cards.',
	durationSeconds: 6,
};

describe('resolveMediaSlot', () => {
	it('renders a sized placeholder until a capture exists', () => {
		expect(resolveMediaSlot(video)).toEqual({
			state: 'placeholder',
			ratioClass: 'media-slot--r16x10',
			width: 1600,
			height: 1000,
			label: 'Cards dragged across a board',
			kind: 'video',
			durationSeconds: 6,
		});
	});

	it('keeps the placeholder box size once the real file lands', () => {
		const placeholder = resolveMediaSlot(video);
		const real = resolveMediaSlot({ ...video, src: 'board-tour.webm', poster: 'board-tour.webp' });
		expect([real.width, real.height, real.ratioClass]).toEqual([placeholder.width, placeholder.height, placeholder.ratioClass]);
	});

	it('resolves a video through the public asset allowlist with its mime type and poster', () => {
		expect(resolveMediaSlot({ ...video, src: 'board-tour.mp4', poster: 'board tour.webp' }, '/base/')).toMatchObject({
			state: 'video',
			src: '/base/assets/board-tour.mp4',
			type: 'video/mp4',
			poster: '/base/assets/board%20tour.webp',
		});
	});

	it('resolves an image', () => {
		const shot: MediaShot = { id: 'mobile', kind: 'image', ratio: '9/16', label: 'Phone', capture: 'Screenshot.', src: 'mobile.webp' };
		expect(resolveMediaSlot(shot)).toMatchObject({ state: 'image', src: '/assets/mobile.webp', width: 900, height: 1600 });
	});

	it('offers the half-width copy of an image as a srcset, through the same allowlist', () => {
		const shot: MediaShot = { id: 'map', kind: 'image', ratio: '16/10', label: 'Map', capture: 'Screenshot.', src: 'map.webp', srcSmall: 'map-800.webp' };
		expect(resolveMediaSlot(shot)).toMatchObject({ src: '/assets/map.webp', srcset: '/assets/map-800.webp 800w, /assets/map.webp 1600w' });
		expect(() => resolveMediaSlot({ ...shot, srcSmall: '../map.webp' })).toThrow(/Unsafe public asset path/u);
	});

	it('rejects traversal and remote URLs', () => {
		expect(() => resolveMediaSlot({ ...video, src: '../secret.mp4' })).toThrow(/Unsafe public asset path/u);
		expect(() => resolveMediaSlot({ ...video, src: 'https://evil.example/clip.mp4' })).toThrow(/Unsafe public asset path/u);
	});

	it('rejects a video shot pointing at an image file', () => {
		expect(() => resolveMediaSlot({ ...video, src: 'board.png' })).toThrow(/not \.webm or \.mp4/u);
	});
});

describe('ratio helpers', () => {
	it('maps every ratio to a CSS class and a capture size with that ratio', () => {
		for (const ratio of ['16/10', '16/9', '4/3', '1/1', '4/5', '9/16'] as const) {
			const [w, h] = ratio.split('/').map(Number);
			const size = captureSize(ratio);
			expect(size.width / size.height).toBeCloseTo((w ?? 1) / (h ?? 1), 5);
			expect(ratioClass(ratio)).toBe(`media-slot--r${w}x${h}`);
		}
	});
});
