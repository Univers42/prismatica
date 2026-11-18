import { describe, it, expect, afterEach } from 'vitest';
import { characterMarkup, mascotSvgMarkup, tubeSlices, SHELL_LEFT } from '../../../src/scripts/mascot-svg';
import { mascotState } from '../../../src/scripts/mascot-state';
import { mascotMotionPaused } from '../../../src/scripts/mascot-effects';
import { resetMascotState } from '../../../src/scripts/mascot-state';
import { stopMascotEffects, startMascotMoodEffect, wakeMascotPose, sleepMascotPose } from '../../../src/scripts/mascot-effects';

describe('mascot modular components', () => {
	afterEach(() => resetMascotState());

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

	it('resetMascotState restores default coordinates and clears timers', () => {
		const beforeMove = mascotState.lastMove;
		mascotState.heartTimer = globalThis.setInterval(() => {}, 1000);
		mascotState.zTimer = globalThis.setInterval(() => {}, 1000);
		mascotState.laughTimer = globalThis.setInterval(() => {}, 1000);
		mascotState.moodTimer = globalThis.setTimeout(() => {}, 1000);
		mascotState.targetX = 10;
		mascotState.targetY = 5;
		mascotState.targetHeadX = 3;
		mascotState.targetHeadY = -2;
		mascotState.depthX = 1;
		mascotState.depthY = 2;
		mascotState.eyeX = 100;
		mascotState.eyeY = 50;
		mascotState.headX = 5;
		mascotState.headY = 5;
		mascotState.lastPointerAngle = 0.5;
		mascotState.orbitTravel = 100;
		mascotState.lastBrowLift = 1000;
		mascotState.lockedUntil = 1000;
		mascotState.idleMoodShown = true;
		mascotState.frame = 1 as any;

		resetMascotState();

		expect(mascotState.targetX).toBe(0);
		expect(mascotState.targetY).toBe(0);
		expect(mascotState.targetHeadX).toBe(0);
		expect(mascotState.targetHeadY).toBe(0);
		expect(mascotState.depthX).toBe(5);
		expect(mascotState.depthY).toBe(4);
		expect(mascotState.eyeX).toBe(0);
		expect(mascotState.eyeY).toBe(0);
		expect(mascotState.headX).toBe(0);
		expect(mascotState.headY).toBe(0);
		expect(mascotState.lastPointerAngle).toBeUndefined();
		expect(mascotState.orbitTravel).toBe(0);
		expect(mascotState.lastBrowLift).toBe(0);
		expect(mascotState.lastMove).toBeGreaterThan(beforeMove - 100);
		expect(mascotState.lastMove).toBeLessThan(beforeMove + 100);
		expect(mascotState.lockedUntil).toBe(0);
		expect(mascotState.idleMoodShown).toBe(false);
		expect(mascotState.frame).toBeUndefined();
		expect(mascotState.heartTimer).toBeUndefined();
		expect(mascotState.zTimer).toBeUndefined();
		expect(mascotState.laughTimer).toBeUndefined();
		expect(mascotState.moodTimer).toBeUndefined();
	});

	it('wakeMascotPose sets --blink and --tilt CSS properties and target head values', () => {
		const mascot = document.createElement('button');
		mascot.className = 'binocle';
		mascot.dataset.mood = 'sleeping';

		wakeMascotPose(mascot as HTMLButtonElement);

		expect(mascot.style.getPropertyValue('--blink')).toBe('1');
		expect(mascot.style.getPropertyValue('--tilt')).toBe('0deg');
		expect(mascotState.targetHeadX).toBe(0);
		expect(mascotState.targetHeadY).toBe(0);
	});

	it('sleepMascotPose sets --blink and --tilt CSS properties and target head values', () => {
		const mascot = document.createElement('button');
		mascot.className = 'binocle';
		mascot.dataset.mood = 'awake';

		sleepMascotPose(mascot as HTMLButtonElement);

		expect(mascot.style.getPropertyValue('--blink')).toBe('0.08');
		expect(mascot.style.getPropertyValue('--tilt')).toBe('9deg');
		expect(mascotState.targetX).toBe(0);
		expect(mascotState.targetY).toBe(0);
		expect(mascotState.eyeX).toBe(0);
		expect(mascotState.eyeY).toBe(0);
		expect(mascotState.targetHeadX).toBe(-7);
		expect(mascotState.targetHeadY).toBe(13);
		expect(mascotState.headX).toBe(-7);
		expect(mascotState.headY).toBe(13);
		expect(mascotState.depthX).toBe(7);
		expect(mascotState.depthY).toBe(2);
	});

	it('startMascotMoodEffect spawns particle elements and sets timers for love', () => {
		const mascot = document.createElement('button');
		mascot.className = 'binocle';

		startMascotMoodEffect(mascot as HTMLButtonElement, 'love' as const);

		const hearts = mascot.querySelectorAll('.binocle__heart');
		expect(hearts.length).toBeGreaterThan(0);
		expect(mascotState.heartTimer).toBeDefined();
	});

	it('startMascotMoodEffect spawns particle elements and sets timers for sleeping', () => {
		const mascot = document.createElement('button');
		mascot.className = 'binocle';

		startMascotMoodEffect(mascot as HTMLButtonElement, 'sleeping' as const);

		const zeds = mascot.querySelectorAll('.binocle__z');
		expect(zeds.length).toBeGreaterThan(0);
		expect(mascotState.zTimer).toBeDefined();
	});

	it('stopMascotEffects clears timers and removes particle DOM nodes', () => {
		const mascot = document.createElement('button');
		mascot.className = 'binocle';

		startMascotMoodEffect(mascot as HTMLButtonElement, 'love' as const);
		expect(mascotState.heartTimer).toBeDefined();

		stopMascotEffects(mascot as HTMLButtonElement);

		expect(mascotState.heartTimer).toBeUndefined();
		const hearts = mascot.querySelectorAll('.binocle__heart');
		expect(hearts.length).toBe(0);
	});

	it('detects motion paused state from document element class', () => {
		document.documentElement.classList.remove('motion-paused');
		expect(mascotMotionPaused()).toBe(false);
		document.documentElement.classList.add('motion-paused');
		expect(mascotMotionPaused()).toBe(true);
		document.documentElement.classList.remove('motion-paused');
	});
});