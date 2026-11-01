import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Terms of Service page contract', () => {
	const content = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/legal/terms.astro'), 'utf-8');

	it('includes semantic title, layout and landmarks', () => {
		expect(content).toContain('title="Terms of Service — Prismatica"');
		expect(content).toContain('<main id="main-content" class="legal-page section-shell">');
		expect(content).toContain('<h1>Terms of Service</h1>');
	});

	it('contains an accessible table of contents navigation', () => {
		expect(content).toContain('<nav class="legal-toc" aria-label="Table of contents">');
		expect(content).toContain('href="#service-description"');
		expect(content).toContain('href="#acceptance"');
		expect(content).toContain('href="#account-security"');
		expect(content).toContain('href="#user-obligations"');
		expect(content).toContain('href="#user-content"');
		expect(content).toContain('href="#availability-modifications"');
		expect(content).toContain('href="#liability"');
		expect(content).toContain('href="#termination"');
		expect(content).toContain('href="#governing-law"');
		expect(content).toContain('href="#contact"');
	});

	it('has matching section IDs for every TOC jump link', () => {
		expect(content).toContain('id="service-description"');
		expect(content).toContain('id="acceptance"');
		expect(content).toContain('id="account-security"');
		expect(content).toContain('id="user-obligations"');
		expect(content).toContain('id="user-content"');
		expect(content).toContain('id="availability-modifications"');
		expect(content).toContain('id="liability"');
		expect(content).toContain('id="termination"');
		expect(content).toContain('id="governing-law"');
		expect(content).toContain('id="contact"');
	});

	it('links to data rights for account deletion and data export', () => {
		expect(content).toContain('href="/legal/data-rights/"');
	});

	it('provides a back-to-top skip link', () => {
		expect(content).toContain('href="#main-content"');
	});
});