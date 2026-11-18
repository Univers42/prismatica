import { describe, it, expect } from 'vitest';
import { characterMarkup, mascotSvgMarkup, tubeSlices, SHELL_LEFT } from '../../../src/scripts/mascot-svg';
import { mascotState } from '../../../src/scripts/mascot-state';
import { mascotMotionPaused } from '../../../src/scripts/mascot-effects';

describe('mascot modular components', () => {
	it('generates valid character markup containing binocle button and svg', () => {
		const html = characterMarkup();
		expect(html).toContain('class="binocle"');
		expect(html).toContain('data-mood="curious"');
		expect(html).toContain('binocle__svg');
		expect(html).toContain('right-lens-hotspot');
	});

	it('generates svg markup with tubes and limbs', () => {
		const svg = mascotSvgMarkup();
		expect(svg).toContain('<svg class="binocle__svg"');
		expect(svg).toContain('svg-body-group');
		expect(svg).toContain('svg-tube-stack');
	});

	it('generates expected tube slices count', () => {
		const slices = tubeSlices(SHELL_LEFT);
		const count = (slices.match(/<path class="svg-tube"/g) || []).length;
		expect(count).toBe(6);
	});

	it('initializes default mascot state coordinates', () => {
		expect(mascotState.targetX).toBe(0);
		expect(mascotState.targetY).toBe(0);
		expect(mascotState.depthX).toBe(5);
		expect(mascotState.depthY).toBe(4);
	});

	it('detects motion paused state from document element class', () => {
		document.documentElement.classList.remove('motion-paused');
		expect(mascotMotionPaused()).toBe(false);
		document.documentElement.classList.add('motion-paused');
		expect(mascotMotionPaused()).toBe(true);
		document.documentElement.classList.remove('motion-paused');
	});
});