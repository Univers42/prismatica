import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const cta = fs.readFileSync(path.resolve(process.cwd(), 'src/components/site/FinalCta.astro'), 'utf-8');

describe('FinalCta', () => {
	it('takes the page locale', () => {
		expect(cta).toContain('const { locale = DEFAULT_LOCALE } = Astro.props;');
	});

	it.each(['title', 'lead', 'create', 'tour'])('localizes %s', (key) => {
		expect(cta).toContain(`data-i18n="site.final.${key}"`);
	});

	it('offers the portal only with JavaScript, and the tour without it', () => {
		expect(cta).toMatch(/data-open-portal data-js-only/);
		expect(cta).toContain('href="/tour/" data-open-tour');
	});
});
