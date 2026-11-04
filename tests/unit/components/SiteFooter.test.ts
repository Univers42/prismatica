import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_CONTROLLER, LEGAL_LINKS } from '../../../src/data/legal';

const read = (file: string): string => fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8');
const footer = read('src/components/site/SiteFooter.astro');
const newsletter = read('src/components/gdpr/NewsletterSignup.astro');

describe('SiteFooter', () => {
	it('labels both link groups', () => {
		expect(footer).toContain('<nav aria-labelledby="footer-product">');
		expect(footer).toContain('<nav aria-labelledby="footer-legal">');
	});

	it.each(LEGAL_LINKS.map((link) => link.href))('routes the legal page %s', (href) => {
		expect(footer).toContain(`'${href}'`);
	});

	it('keeps the cookie settings trigger, which needs the script', () => {
		expect(footer).toMatch(/<li data-js-only><button[^>]*type="button"[^>]*data-manage-cookies/);
	});

	it('hardens the social links', () => {
		expect(footer).toContain('<a href={ORGANIZATION_URL} rel="noopener noreferrer">GitHub</a>');
		expect(footer).toContain('<a href={LINKEDIN_URL} rel="noopener noreferrer">LinkedIn</a>');
	});

	it('names who answers for the data, with a way to reach them', () => {
		expect(DATA_CONTROLLER.email).toContain('@');
		expect(footer).toContain('{DATA_CONTROLLER.name}');
		expect(footer).toContain('href={`mailto:${DATA_CONTROLLER.email}`}');
	});

	it('states the current year', () => {
		expect(footer).toContain('new Date().getFullYear()');
		expect(footer).toContain('© {year} Prismatica');
	});
});

describe('NewsletterSignup', () => {
	it('validates in its own script', () => {
		expect(newsletter).toMatch(/<form\b[^>]*\bnovalidate\b/);
	});

	it('requires the address and the consent, each with a label', () => {
		expect(newsletter).toMatch(/name="email"[^>]*type="email"[^>]*autocomplete="email"[^>]*required/);
		expect(newsletter).toMatch(/name="newsletter_consent"[^>]*type="checkbox"[^>]*required/);
		expect(newsletter).toContain('for={`${id}-email`}');
		expect(newsletter).toContain('for={`${id}-consent`}');
	});

	it('carries the Turnstile slot and token the gateway checks', () => {
		expect(newsletter).toContain('data-turnstile-slot');
		expect(newsletter).toContain('type="hidden" name="turnstileToken" data-turnstile-token');
	});

	it('reports the outcome in a live region', () => {
		expect(newsletter).toMatch(/<output\b[^>]*aria-live="polite"[^>]*data-newsletter-status/);
	});
});
