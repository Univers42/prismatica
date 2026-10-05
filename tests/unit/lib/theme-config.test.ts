import { describe, it, expect } from 'vitest';
import { isThemeName, normalizeTheme, themeIcon, themeDisplayName } from '../../../src/lib/theme-config';

describe('theme-config', () => {
	describe('isThemeName', () => {
		it('returns true for valid themes', () => {
			expect(isThemeName('swiss')).toBe(true);
			expect(isThemeName('aurora')).toBe(true);
			expect(isThemeName('solar')).toBe(true);
			expect(isThemeName('ember')).toBe(true);
			expect(isThemeName('forest')).toBe(true);
		});
		it('returns false for invalid themes', () => {
			expect(isThemeName('light')).toBe(false);
			expect(isThemeName(null)).toBe(false);
			expect(isThemeName(undefined)).toBe(false);
			expect(isThemeName('unknown')).toBe(false);
		});
	});

	describe('normalizeTheme', () => {
		it('returns valid themes directly', () => {
			expect(normalizeTheme('swiss')).toBe('swiss');
		});
		it('maps legacy "light" to "swiss"', () => {
			expect(normalizeTheme('light')).toBe('swiss');
		});
		it('maps legacy "dark" or "night" to "aurora"', () => {
			expect(normalizeTheme('dark')).toBe('aurora');
			expect(normalizeTheme('night')).toBe('aurora');
		});
		it('returns null for unknown themes', () => {
			expect(normalizeTheme('unknown')).toBeNull();
			expect(normalizeTheme(null)).toBeNull();
		});
	});

	describe('themeIcon', () => {
		it('returns correct icons', () => {
			expect(themeIcon('swiss')).toBe('▦');
			expect(themeIcon('aurora')).toBe('✦');
		});
	});

	describe('themeDisplayName', () => {
		it('returns capitalized labels', () => {
			expect(themeDisplayName('swiss')).toBe('Swiss');
			expect(themeDisplayName('ember')).toBe('Ember');
		});
	});
});
