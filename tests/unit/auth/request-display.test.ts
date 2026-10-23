// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderHtmlTemplate } from '../../../scripts/auth/mail-templates.mjs';
import { displaySafe, loginAlertMailFields } from '../../../scripts/auth/request-display.mjs';

const dir = resolve(__dirname, '../../../src/email-templates');
const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const HOSTILE = '<script>alert(1)</script>';

describe('displaySafe', () => {
	it.each([
		[HOSTILE, 'script alert(1) /script'],
		[CHROME, 'Mozilla/5.0 (X11 Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'],
		['$(rm -rf /)', '(rm -rf /)'],
		['a|b', 'a b'],
		['Agent\r\nBcc: evil@x.test', 'Agent Bcc: evil x.test'],
		['2001:db8::1', '2001:db8::1'],
		['203.0.113.7, 10.0.0.2', '203.0.113.7, 10.0.0.2'],
		["it's `x` \"y\" &z;", 'it s x y z'],
		['', 'unknown'],
		['   ', 'unknown'],
		['<>;&', 'unknown'],
		[undefined, 'unknown'],
	])('shows %j as %j', (input, shown) => {
		expect(displaySafe(input, 160)).toBe(shown);
	});

	it('caps a 10k value and marks the cut', () => {
		const shown = displaySafe('a'.repeat(10_000), 160);
		expect(shown).toBe(`${'a'.repeat(160)}...`);
	});

	it('uses the caller placeholder when nothing survives', () => {
		expect(displaySafe(';;', 160, 'unknown device')).toBe('unknown device');
	});

	it('never lets a character the WAF reads as an attack through', () => {
		const everything = Array.from({ length: 256 }, (_, code) => String.fromCodePoint(code)).join('');
		expect(displaySafe(everything, 1000)).toMatch(/^[A-Za-z0-9 .,:/()_+-]+$/);
	});
});

describe('the sign-in alert', () => {
	const headers = (userAgent: string) => ({ 'user-agent': userAgent, origin: 'https://site.example', referer: `https://site.example/a?x=1&y=${HOSTILE}`, 'x-forwarded-for': '203.0.113.7, 2001:db8::1' });
	const render = (outcome: 'success' | 'failed', userAgent: string) => {
		const fields = loginAlertMailFields({ headers: headers(userAgent), ipAddress: '2001:db8::1', location: 'Paris, FR (Europe/Paris)', outcome });
		return { fields, html: renderHtmlTemplate(dir, 'login-alert.html', { email: 'ines@arlet.test', siteUrl: 'https://prismatica.example', occurredAt: 'now', ...fields }) };
	};

	it.each(['success', 'failed'] as const)('carries no attack-shaped text from a hostile User-Agent (%s)', (outcome) => {
		const { fields, html } = render(outcome, HOSTILE);
		for (const value of Object.values(fields)) expect(value).not.toMatch(/[<>&;"'`$|\r\n]/);
		const device = html.match(/Device<\/strong>([^<]*)<\/p>/)?.[1] ?? '';
		const metadata = html.match(/Request metadata:([^<]*)<\/p>/)?.[1] ?? '';
		expect(device.trim()).toBe('script alert(1) /script');
		for (const region of [device, metadata]) {
			expect(region).not.toMatch(/&lt;|&gt;|&amp;|&quot;|&#39;|;|<script/i);
		}
		expect(html).not.toMatch(/<script/i);
		expect(html).toContain('2001:db8::1');
	});

	it('still reads sensibly for a normal browser', () => {
		const { html } = render('success', CHROME);
		expect(html).toContain('Mozilla/5.0 (X11 Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36');
		expect(html).toContain('Paris, FR (Europe/Paris)');
	});
});
