import { describe, expect, it } from 'vitest';
import { formatEuros } from '../../../src/lib/money';

describe('formatEuros', () => {
	it('keeps the English form the page renders', () => {
		expect(formatEuros('en', 17570)).toBe('€17,570');
	});

	it('moves the sign and the separator for Spanish', () => {
		expect(formatEuros('es', 17570).replace(/\s/g, ' ')).toBe('17.570 €');
	});

	it('keeps Western digits in Arabic, as the copy around it does', () => {
		expect(formatEuros('ar', 17570)).toMatch(/17.570/);
	});

	it.each([0, 4920, 59200])('never shows cents on %d', (amount) => {
		expect(formatEuros('en', amount)).not.toContain('.');
	});
});
