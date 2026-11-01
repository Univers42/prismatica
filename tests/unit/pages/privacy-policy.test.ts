import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Privacy Policy page contract', () => {
	const content = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/legal/privacy-policy.astro'), 'utf-8');

	it('includes semantic title, layout and landmarks', () => {
		expect(content).toContain('title="Privacy Policy — Prismatica"');
		expect(content).toContain('<main id="main-content" class="legal-page section-shell">');
		expect(content).toContain('<h1>Privacy Policy</h1>');
	});

	it('contains an accessible table of contents navigation', () => {
		expect(content).toContain('<nav class="legal-toc" aria-label="Table of contents">');
		expect(content).toContain('href="#data-controller"');
		expect(content).toContain('href="#data-collected"');
		expect(content).toContain('href="#retention"');
		expect(content).toContain('href="#storage-recipients"');
		expect(content).toContain('href="#international-transfers"');
		expect(content).toContain('href="#user-rights"');
		expect(content).toContain('href="#cookies-tracking"');
		expect(content).toContain('href="#security"');
		expect(content).toContain('href="#children"');
		expect(content).toContain('href="#policy-changes"');
		expect(content).toContain('href="#contact"');
	});

	it('has matching section IDs for every TOC jump link', () => {
		expect(content).toContain('id="data-controller"');
		expect(content).toContain('id="data-collected"');
		expect(content).toContain('id="retention"');
		expect(content).toContain('id="storage-recipients"');
		expect(content).toContain('id="international-transfers"');
		expect(content).toContain('id="user-rights"');
		expect(content).toContain('id="cookies-tracking"');
		expect(content).toContain('id="security"');
		expect(content).toContain('id="children"');
		expect(content).toContain('id="policy-changes"');
		expect(content).toContain('id="contact"');
	});

	it('links directly to self-service data rights and cookies policy', () => {
		expect(content).toContain('href="/legal/data-rights/"');
		expect(content).toContain('href="/legal/cookies/"');
	});

	it('provides a back-to-top skip link', () => {
		expect(content).toContain('href="#main-content"');
	});
});