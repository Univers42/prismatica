import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const savedView = fs.readFileSync(path.resolve(process.cwd(), 'src/components/site/SavedView.astro'), 'utf-8');

describe('SavedView', () => {
	// A screen reader ignores aria-label on an element with no role.
	it('gives the filter chips a role their name can attach to', () => {
		expect(savedView).toMatch(/class="v4__chips" role="group" aria-label=/);
	});

	it('keeps amounts reformattable per language', () => {
		expect(savedView.match(/data-i18n-amount=\{deal\.amount\}/g)).toHaveLength(2);
	});
});
