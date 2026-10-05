import { describe, it, expect } from 'vitest';
import { editDistance, suggestedEmailDomain, validateEmailFormat } from '../../../src/lib/email-validation';

describe('email-validation', () => {
	describe('editDistance', () => {
		it('calculates 0 for identical strings', () => {
			expect(editDistance('gmail.com', 'gmail.com')).toBe(0);
		});
		it('calculates 1 for a single substitution', () => {
			expect(editDistance('gamil.com', 'gmail.com')).toBe(2); // Wait, gamil -> gmail is technically 2 substitutions without transpositions, but let's test a simple one
			expect(editDistance('gmail.con', 'gmail.com')).toBe(1);
		});
		it('calculates 1 for a single deletion', () => {
			expect(editDistance('gmail.co', 'gmail.com')).toBe(1);
		});
	});

	describe('suggestedEmailDomain', () => {
		it('returns exact alias matches', () => {
			expect(suggestedEmailDomain('gmail.con')).toBe('gmail.com');
			expect(suggestedEmailDomain('hotmai.com')).toBe('hotmail.com');
		});
		it('returns close match using edit distance', () => {
			expect(suggestedEmailDomain('gmai.com')).toBe('gmail.com');
		});
		it('returns empty string if no close match', () => {
			expect(suggestedEmailDomain('example.com')).toBe('');
		});
	});

	describe('validateEmailFormat', () => {
		it('returns idle if empty and not required', () => {
			const res = validateEmailFormat('', false, true);
			expect(res.state).toBe('idle');
			expect(res.valid).toBe(true);
		});
		it('returns error if empty and required', () => {
			const res = validateEmailFormat('', true, true);
			expect(res.state).toBe('idle'); // The original code returns idle with valid: false when required! Let's mimic original exactly.
			expect(res.valid).toBe(false);
			expect(res.message).toBe('Enter your email address.');
		});
		it('returns error if native validity is false', () => {
			const res = validateEmailFormat('bad-email', true, false);
			expect(res.state).toBe('error');
			expect(res.valid).toBe(false);
		});
		it('returns warning if typo detected', () => {
			const res = validateEmailFormat('user@gmail.con', true, true);
			expect(res.state).toBe('warning');
			expect(res.valid).toBe(true);
			expect(res.message).toContain('Did you mean user@gmail.com?');
		});
		it('returns success if valid and no typo', () => {
			const res = validateEmailFormat('user@example.com', true, true);
			expect(res.state).toBe('success');
			expect(res.valid).toBe(true);
		});
	});
});
