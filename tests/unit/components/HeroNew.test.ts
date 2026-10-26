import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const componentPath = path.resolve(process.cwd(), 'src/components/sections/HeroNew.astro');
const componentMarkup = fs.readFileSync(componentPath, 'utf-8');

describe('HeroNew component', () => {
	it('declares Props with locale', () => {
		expect(componentMarkup).toContain('type Props = {');
		expect(componentMarkup).toContain('readonly locale?: string');
	});

	it('imports t from ../lib/i18n', () => {
		expect(componentMarkup).toContain("import { t,");
	});

	it('headline uses t(activeLocale, hero.title)', () => {
		expect(componentMarkup).toContain("t(activeLocale, 'hero.title')");
	});

	it('lede uses t(activeLocale, hero.lede)', () => {
		expect(componentMarkup).toContain("t(activeLocale, 'hero.lede')");
	});

	it('CTA start free uses t(activeLocale, hero.startFree)', () => {
		expect(componentMarkup).toContain("t(activeLocale, 'hero.startFree')");
	});

	it('CTA see apps uses t(activeLocale, hero.seeApps)', () => {
		expect(componentMarkup).toContain("t(activeLocale, 'hero.seeApps')");
	});

	it('note uses t(activeLocale, hero.note)', () => {
		expect(componentMarkup).toContain("t(activeLocale, 'hero.note')");
	});
});