import { describe, expect, it } from 'vitest';
import { en } from '../../../src/data/locales/en';
import { es } from '../../../src/data/locales/es';
import { ar } from '../../../src/data/locales/ar';
import type { UIStrings } from '../../../src/data/locales/types';

function extractKeyPaths(record: Record<string, unknown>, prefix = ''): string[] {
	const paths: string[] = [];
	for (const [key, value] of Object.entries(record)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			paths.push(...extractKeyPaths(value as Record<string, unknown>, fullKey));
		} else {
			paths.push(fullKey);
		}
	}
	return paths;
}

function getValueByPath(record: Record<string, unknown>, path: string): unknown {
	return path.split('.').reduce<unknown>((acc, part) => {
		if (acc && typeof acc === 'object' && part in acc) {
			return (acc as Record<string, unknown>)[part];
		}
		return undefined;
	}, record);
}

describe('locales data dictionaries', () => {
	const locales: Array<{ name: string; dict: UIStrings }> = [
		{ name: 'en', dict: en },
		{ name: 'es', dict: es },
		{ name: 'ar', dict: ar },
	];

	it('exports valid dictionary objects for all supported locales', () => {
		for (const { name, dict } of locales) {
			expect(dict, `locale ${name} must be defined`).toBeDefined();
			expect(typeof dict, `locale ${name} must be an object`).toBe('object');
			expect(dict.a11y.skipToContent.length).toBeGreaterThan(0);
		}
	});

	it('maintains strict key symmetry: every key in English exists in Spanish and Arabic', () => {
		const enPaths = extractKeyPaths(en as unknown as Record<string, unknown>).sort();
		expect(enPaths.length).toBeGreaterThan(50);

		for (const { name, dict } of locales.filter((l) => l.name !== 'en')) {
			const targetPaths = extractKeyPaths(dict as unknown as Record<string, unknown>).sort();
			expect(targetPaths, `locale ${name} must have identical keys to en`).toEqual(enPaths);
		}
	});

	it('contains non-empty string values for all translation leaf nodes', () => {
		const enPaths = extractKeyPaths(en as unknown as Record<string, unknown>);

		for (const { name, dict } of locales) {
			for (const path of enPaths) {
				const value = getValueByPath(dict as unknown as Record<string, unknown>, path);
				expect(typeof value, `${name}.${path} must be a string`).toBe('string');
				expect((value as string).trim().length, `${name}.${path} must not be empty`).toBeGreaterThan(0);
			}
		}
	});
});