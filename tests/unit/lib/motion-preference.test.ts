import { afterEach, describe, expect, it } from 'vitest';
import { motionAllowed } from '../../../src/lib/motion-preference';

describe('motionAllowed', () => {
	afterEach(() => document.documentElement.classList.remove('motion-paused'));

	it('allows motion until the visitor pauses it', () => {
		expect(matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false);
		expect(motionAllowed()).toBe(true);
		document.documentElement.classList.add('motion-paused');
		expect(motionAllowed()).toBe(false);
	});
});
