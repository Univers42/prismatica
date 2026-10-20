import { describe, expect, it } from 'vitest';
import { MAX_APP_WIDTH, MIN_APP_WIDTH, MIN_ZOOM, SCRUB_SMOOTHING_MS, TARGET_ZOOM, easeToward, screenLayout, scrollInVh } from '../../../src/scripts/hero-devices';

describe('hero laptop screen layout', () => {
	it('lays the app out at its desktop width on a wide screen and zooms it to fit', () => {
		const wide = screenLayout(696);
		expect(wide).toMatchObject({ width: MAX_APP_WIDTH, height: 600, usable: true });
		expect(wide.zoom * wide.width).toBeCloseTo(696);
	});

	it('narrows the app on a small screen so it stays legible instead of shrinking', () => {
		const phone = screenLayout(290);
		expect(phone.width).toBe(483);
		expect(phone.height).toBe(302);
		expect(phone.zoom).toBeCloseTo(TARGET_ZOOM, 2);
		expect(phone.usable).toBe(true);
	});

	it('keeps the app usable only while its 44px controls stay at least 24px', () => {
		expect(44 * MIN_ZOOM).toBeGreaterThanOrEqual(24);
		expect(screenLayout(MIN_APP_WIDTH * MIN_ZOOM).usable).toBe(true);
		expect(screenLayout(MIN_APP_WIDTH * MIN_ZOOM - 1).usable).toBe(false);
	});

	it('measures page scroll in viewport hundredths, like the vh scroll ranges', () => {
		expect(scrollInVh(0, 900)).toBe(0);
		expect(scrollInVh(585, 900)).toBe(65);
		expect(scrollInVh(300, 0)).toBe(0);
	});

	it('eases the scroll scrub toward its target without overshooting, then lands on it', () => {
		const oneConstant = easeToward(0, 100, SCRUB_SMOOTHING_MS);
		expect(oneConstant).toBeCloseTo(100 * (1 - Math.exp(-1)));
		let shown = 0;
		for (let frame = 0; frame < 120 && shown !== 100; frame += 1) {
			const next = easeToward(shown, 100, 16);
			expect(next).toBeGreaterThan(shown);
			expect(next).toBeLessThanOrEqual(100);
			shown = next;
		}
		expect(shown).toBe(100);
		expect(easeToward(40, 40, 16)).toBe(40);
	});
});
