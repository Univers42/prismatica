import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const base = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/base/_base.scss'), 'utf-8');

describe('base styles', () => {
	// Dropping this showed every hidden form field, card and empty action link: .field, .auth-card
	// and .button all set display, which outranks the browser's own [hidden] rule.
	it('lets the hidden attribute win over component display rules', () => {
		expect(base).toMatch(/\[hidden\] \{\s*display: none !important;\s*\}/);
	});

	// showModal does not stop the page behind the dialog from scrolling.
	it('locks the page while the portal is open', () => {
		expect(base).toMatch(/body\.portal-open \{\s*overflow: hidden;\s*\}/);
	});
});
