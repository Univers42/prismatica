import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Reads the palettes straight from the stylesheet, so a token edit that breaks contrast fails
// here; nothing is copied into the test. WCAG 2.x: 4.5:1 for text, 3:1 for control boundaries
// and the focus ring (1.4.3, 1.4.11).

const source = readFileSync(join(process.cwd(), 'src/styles/abstracts/_tokens.scss'), 'utf-8');

function block(pattern: RegExp): string {
	const match = source.match(pattern);
	if (!match?.[1]) throw new Error(`token block not found: ${pattern}`);
	return match[1];
}

function hexTokens(body: string): Record<string, string> {
	const tokens: Record<string, string> = {};
	for (const [, name, value] of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)) {
		tokens[name] = value.length === 4 ? `#${[...value.slice(1)].map((c) => c + c).join('')}` : value;
	}
	return tokens;
}

const light = hexTokens(block(/^:root\s*\{([\s\S]*?)^\}/m));
const dark = { ...light, ...hexTokens(block(/@mixin dark-palette\s*\{([\s\S]*?)^\}/m)) };

function luminance(hex: string): number {
	const channel = (offset: number): number => {
		const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const TEXT: [string, string][] = [
	['ink', 'paper'], ['ink', 'raised'], ['ink', 'tint'],
	['graphite', 'paper'], ['graphite', 'raised'], ['graphite', 'tint'],
	['signal', 'paper'], ['signal', 'raised'],
	['danger', 'paper'], ['danger', 'raised'],
	['success', 'paper'], ['success', 'raised'],
	['warning', 'paper'], ['warning', 'raised'],
	['on-signal', 'signal'], ['paper', 'ink'],
];

const BOUNDARY: [string, string][] = [
	['graphite', 'paper'], ['graphite', 'raised'],
	['signal', 'paper'], ['signal', 'raised'], ['signal', 'tint'],
];

describe.each([
	['light', light],
	['dark', dark],
])('%s palette', (_, palette) => {
	it('defines every token the pairs below use', () => {
		for (const [fg, bg] of [...TEXT, ...BOUNDARY]) {
			expect(palette[fg], `--${fg}`).toMatch(/^#[0-9a-f]{6}$/i);
			expect(palette[bg], `--${bg}`).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it.each(TEXT)('text --%s on --%s is at least 4.5:1', (fg, bg) => {
		expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(4.5);
	});

	it.each(BOUNDARY)('boundary --%s on --%s is at least 3:1', (fg, bg) => {
		expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(3);
	});
});

describe('the contrast helper', () => {
	it('gives 21:1 for black on white and 1:1 for a colour on itself', () => {
		expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
		expect(contrast('#56565f', '#56565f')).toBeCloseTo(1, 5);
	});

	it('reads dark overrides over the light palette', () => {
		expect(dark.paper).not.toBe(light.paper);
		expect(dark['font-display']).toBeUndefined();
	});
});
