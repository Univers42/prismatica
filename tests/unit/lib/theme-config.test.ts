import { describe, it, expect } from 'vitest';
import { normalizeTheme, nextTheme, themeLabel } from '../../../src/lib/theme-config';

describe('theme-config', () => {
	it('keeps the three current choices', () => {
		expect(normalizeTheme('light')).toBe('light');
		expect(normalizeTheme('dark')).toBe('dark');
		expect(normalizeTheme('system')).toBe('system');
	});

	it('maps a choice stored by the old five-theme site onto light or dark', () => {
		expect(normalizeTheme('swiss')).toBe('light');
		expect(normalizeTheme('solar')).toBe('light');
		expect(normalizeTheme('aurora')).toBe('dark');
		expect(normalizeTheme('ember')).toBe('dark');
		expect(normalizeTheme('forest')).toBe('dark');
	});

	it('falls back to the OS for anything else', () => {
		expect(normalizeTheme(null)).toBe('system');
		expect(normalizeTheme(undefined)).toBe('system');
		expect(normalizeTheme('neon')).toBe('system');
	});

	it('cycles system → light → dark → system', () => {
		expect(nextTheme('system')).toBe('light');
		expect(nextTheme('light')).toBe('dark');
		expect(nextTheme('dark')).toBe('system');
	});

	it('names each choice for the toggle', () => {
		expect(themeLabel('system')).toBe('Match system');
		expect(themeLabel('dark')).toBe('Dark');
	});
});
