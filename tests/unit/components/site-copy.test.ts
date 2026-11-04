import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CHAPTERS } from '../../../src/data/tour';
import { SHOTS } from '../../../src/data/shots';
import { DICTIONARY, SUPPORTED_LOCALES, t } from '../../../src/lib/i18n';

// Caveat: this reads component source, not rendered output, so text assembled in frontmatter or a
// non-translated prop passes here. groot's ST7 walks the rendered Arabic page for that case.
const SURFACES = [
	'src/components/site/CaptureFrame.astro',
	'src/components/site/FinalCta.astro',
	'src/components/site/Hero.astro',
	'src/components/site/Learning.astro',
	'src/components/site/OneRecord.astro',
	'src/components/site/Plainly.astro',
	'src/components/site/RunIt.astro',
	'src/components/site/SavedView.astro',
	'src/components/site/Silo.astro',
	'src/components/site/SiteFooter.astro',
	'src/components/site/SiteHeader.astro',
	'src/components/site/StorySection.astro',
	'src/components/site/TourDialog.astro',
	'src/components/site/TourPlayer.astro',
	'src/components/site/Views.astro',
	'src/components/gdpr/ConsentBanner.astro',
	'src/components/gdpr/NewsletterSignup.astro',
	'src/pages/index.astro',
	'src/pages/tour.astro',
];

// Names, not copy. A noscript note has no script to swap it, so it stays in the page's language.
const NOT_TRANSLATED = /\b(Prismatica|GitHub|LinkedIn|Marc Delorme)\b/g;

function read(file: string): string {
	return fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8');
}

function markupOf(source: string): string {
	return source
		.replace(/^---[\s\S]*?\n---\n/, '')
		.replace(/<style[\s\S]*?<\/style>/g, '')
		.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
}

function bareText(markup: string): string[] {
	return markup
		.replace(/<[^>]*>/g, '\n')
		.replace(/{[^{}\n]*}/g, ' ')
		.split('\n')
		.map((line) => line.replace(NOT_TRANSLATED, '').trim())
		.filter((line) => /[a-zA-Z]{2,}/.test(line))
		.filter((line) => !/^[{)}]|=>|\? \($/.test(line));
}

function keysIn(source: string): string[] {
	return [...source.matchAll(/["'`]((?:site|nav|auth|footer|a11y)\.[a-zA-Z0-9.]+)["'`]/g)].map((match) => match[1] ?? '');
}

describe.each(SURFACES)('%s', (file) => {
	const source = read(file);

	it('has no text a language change would miss', () => {
		expect(bareText(markupOf(source))).toEqual([]);
	});

	it('has no literal label or alt', () => {
		expect(markupOf(source).match(/(?<![-\w])(aria-label|title|alt)="[^"]+"/g) ?? []).toEqual([]);
	});

	it('names only keys that exist in every language', () => {
		for (const key of keysIn(source)) {
			for (const locale of SUPPORTED_LOCALES) expect(t(locale, key), `${locale} ${key}`).not.toBe(key);
		}
	});

	it('marks each string it translates, or the swap at runtime skips it', () => {
		for (const call of markupOf(source).matchAll(/>\{t\(locale, ['"]([^'"]+)['"]/g)) {
			const opening = markupOf(source).slice(0, call.index + 1);
			expect(opening.slice(opening.lastIndexOf('<')), call[1]).toContain(`data-i18n="${call[1]}"`);
		}
	});
});

describe('keys built at render time', () => {
	it.each(Object.keys(SHOTS))('shot %s has a title and alt text', (id) => {
		for (const locale of SUPPORTED_LOCALES) {
			expect(t(locale, `site.shots.${id}.title`)).not.toBe(`site.shots.${id}.title`);
			expect(t(locale, `site.shots.${id}.alt`)).not.toBe(`site.shots.${id}.alt`);
		}
	});

	it.each(CHAPTERS.map((chapter) => chapter.key))('chapter %s has a title and a caption', (key) => {
		expect(DICTIONARY.ar.site.tour.steps[key].title).toBeTruthy();
		expect(DICTIONARY.es.site.tour.steps[key].caption).toBeTruthy();
	});
});
