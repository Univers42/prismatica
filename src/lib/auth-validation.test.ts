import { describe, it, expect } from 'vitest';
import { checkPasswordStrength, passwordRuleResults } from './auth-validation';

describe('auth-validation', () => {
	describe('passwordRuleResults', () => {
		it('returns all false for empty password', () => {
			const rules = passwordRuleResults('');
			expect(rules.every(r => !r.passed)).toBe(true);
		});

		it('passes 8+ characters rule', () => {
			const rules = passwordRuleResults('12345678');
			expect(rules.find(r => r.label === '8+ characters')?.passed).toBe(true);
		});

		it('passes Uppercase letter rule', () => {
			const rules = passwordRuleResults('A');
			expect(rules.find(r => r.label === 'Uppercase letter')?.passed).toBe(true);
		});

		it('passes common password check', () => {
			const rules = passwordRuleResults('password');
			expect(rules.find(r => r.label === 'Avoid common passwords')?.passed).toBe(false);
		});
	});

	describe('checkPasswordStrength', () => {
		it('returns empty level for empty string', () => {
			const res = checkPasswordStrength('');
			expect(res.level).toBe('empty');
			expect(res.score).toBe(0);
			expect(res.passed).toBe(false);
		});

		it('returns strong level for a very strong password', () => {
			const res = checkPasswordStrength('Str0ng!P@ssw0rd');
			expect(res.level).toBe('strong');
			expect(res.score).toBe(4);
			expect(res.passed).toBe(true);
		});

		it('returns weak level for a bad password', () => {
			const res = checkPasswordStrength('123');
			expect(res.level).toBe('weak');
			expect(res.passed).toBe(false);
		});
	});
});
