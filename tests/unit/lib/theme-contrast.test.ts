import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEMES, type ThemeName } from '../../../src/lib/theme-config';

// WCAG 2.2 AA contrast for every theme, read from the SCSS that ships rather
// than from copied values. Each theme's custom properties are collected from
// the `:root` and `:root[data-theme='x']` blocks in cascade order, var() and
// color-mix(in srgb) are resolved, and translucent colours are composited over
// the ground they sit on.
// Caveat: only flat `:root` blocks are read, so a token overridden inside a
// media query or on a component is not seen; an unparseable value throws, so a
// new colour syntax fails this test instead of passing it unchecked.

const STYLES = resolve(__dirname, '../../../src/styles');
const SOURCES = ['abstracts/_brand-tokens.scss', 'abstracts/_system-tokens.scss', 'abstracts/_tokens.scss', 'themes/_color-modes.scss', 'abstracts/_swiss.scss'];

type Rgba = [number, number, number, number];

function blocks(): { selectors: string[]; body: string }[] {
	return SOURCES.flatMap((file) => {
		const css = readFileSync(resolve(STYLES, file), 'utf8')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/(^|\s)\/\/.*$/gm, '$1');
		return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selectors: m[1].split(',').map((s) => s.trim()), body: m[2] }));
	});
}

function tokensFor(theme: ThemeName): Map<string, string> {
	const base = new Map<string, string>();
	const themed = new Map<string, string>();
	for (const { selectors, body } of blocks()) {
		const target = selectors.includes(`:root[data-theme='${theme}']`) ? themed : selectors.includes(':root') ? base : null;
		if (!target) continue;
		for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) target.set(m[1], m[2].trim());
	}
	return new Map([...base, ...themed]);
}

function splitTopLevel(text: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '(') depth++;
		else if (text[i] === ')') depth--;
		else if (text[i] === ',' && depth === 0) {
			parts.push(text.slice(start, i).trim());
			start = i + 1;
		}
	}
	return [...parts, text.slice(start).trim()];
}

function parseColor(raw: string, tokens: Map<string, string>, seen: string[] = []): Rgba {
	const value = raw.trim();
	const ref = /^var\((--[\w-]+)\)$/.exec(value);
	if (ref) {
		const next = tokens.get(ref[1]);
		if (next === undefined || seen.includes(ref[1])) throw new Error(`unresolved ${ref[1]}`);
		return parseColor(next, tokens, [...seen, ref[1]]);
	}
	if (value === 'transparent') return [0, 0, 0, 0];
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
	if (hex) {
		const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
		return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)).concat(1) as Rgba;
	}
	const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
	if (rgb) {
		const [r, g, b, a = '1'] = rgb[1].split(',').map((p) => p.trim());
		return [Number(r), Number(g), Number(b), Number(a)];
	}
	const mix = /^color-mix\(in srgb,(.*)\)$/s.exec(value);
	if (mix) {
		const [first, second] = splitTopLevel(mix[1]).map((part) => {
			const pct = /\s(\d+(?:\.\d+)?)%$/.exec(part);
			return { color: parseColor(pct ? part.slice(0, pct.index) : part, tokens, seen), share: pct ? Number(pct[1]) / 100 : undefined };
		});
		const p = first.share ?? (second.share === undefined ? 0.5 : 1 - second.share);
		// Premultiplied interpolation, as CSS Color 5 specifies for color-mix.
		const alpha = first.color[3] * p + second.color[3] * (1 - p);
		const channel = (i: number) => alpha === 0 ? 0 : (first.color[i] * first.color[3] * p + second.color[i] * second.color[3] * (1 - p)) / alpha;
		return [channel(0), channel(1), channel(2), alpha];
	}
	throw new Error(`cannot parse colour "${value}"`);
}

const over = (top: Rgba, ground: Rgba): Rgba => [0, 1, 2].map((i) => top[i] * top[3] + ground[i] * (1 - top[3])).concat(1) as Rgba;

function luminance([r, g, b]: Rgba): number {
	const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgba, b: Rgba): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const UI = 3;
const GROUNDS = ['--system-bg', '--system-surface', '--system-surface-raised', '--system-surface-sunken'];

// [foreground, background(s), minimum]. Decorative hairlines (--system-border,
// --system-divider) are left out: 1.4.11 asks 3:1 only of boundaries that
// identify a control, which here is the input border.
const PAIRS: [string, string[], number][] = [
	['--system-text-strong', GROUNDS, TEXT],
	['--system-text', GROUNDS, TEXT],
	['--system-text-muted', GROUNDS, TEXT],
	['--system-link', ['--system-bg', '--system-surface'], TEXT],
	['--system-link-hover', ['--system-bg', '--system-surface'], TEXT],
	['--system-action-fg', ['--system-action-bg', '--system-action-bg-hover', '--system-action-bg-active'], TEXT],
	['--system-action-secondary-fg', ['--system-action-secondary-bg', '--system-action-secondary-bg-hover'], TEXT],
	['--system-text-on-accent', ['--brand-palette-primary'], TEXT],
	['--system-success-text', ['--system-success-bg', '--system-surface'], TEXT],
	['--system-warning-text', ['--system-warning-bg', '--system-surface'], TEXT],
	['--system-danger-text', ['--system-danger-bg', '--system-surface'], TEXT],
	['--system-info-text', ['--system-info-bg', '--system-surface'], TEXT],
	['--system-input-fg', ['--system-input-bg'], TEXT],
	['--system-input-placeholder', ['--system-input-bg'], TEXT],
	['--system-chip-fg', ['--system-chip-bg'], TEXT],
	['--system-dialog-fg', ['--system-dialog-bg'], TEXT],
	['--system-dialog-summary-muted', ['--system-dialog-summary-bg'], TEXT],
	['--system-input-border', ['--system-input-bg'], UI],
	['--system-focus-ring', ['--system-bg', '--system-surface'], UI],
	['--brand-palette-primary', ['--system-bg', '--system-surface'], UI],
	['--brand-palette-secondary', ['--system-bg', '--system-surface'], UI],
];

describe('theme contrast (WCAG 2.2 AA, read from the SCSS)', () => {
	it('composites a translucent colour mix the way CSS does', () => {
		const tokens = new Map([['--ink', '#000000'], ['--half', 'color-mix(in srgb, var(--ink) 50%, transparent)']]);
		const grey = over(parseColor('var(--half)', tokens), [255, 255, 255, 1]);
		expect(grey.map(Math.round)).toEqual([128, 128, 128, 1]);
		expect(contrast([0, 0, 0, 1], [255, 255, 255, 1])).toBeCloseTo(21, 5);
	});

	for (const theme of THEMES) {
		it(`${theme}: every pair meets its minimum`, () => {
			const tokens = tokensFor(theme);
			const page = over(parseColor('var(--system-bg)', tokens), [255, 255, 255, 1]);
			const failures = PAIRS.flatMap(([fg, bgs, min]) => bgs.flatMap((bg) => {
				const ground = over(parseColor(`var(${bg})`, tokens), page);
				const ratio = contrast(over(parseColor(`var(${fg})`, tokens), ground), ground);
				return ratio < min ? [`${fg} on ${bg}: ${ratio.toFixed(2)} < ${min}`] : [];
			}));
			expect(failures).toEqual([]);
		});
	}
});
