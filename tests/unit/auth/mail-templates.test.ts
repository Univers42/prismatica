// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES, renderMessage } from '../../../scripts/auth/mail-templates.mjs';

const dir = resolve(__dirname, '../../../src/email-templates');
const vars = {
	email: 'ines@arlet.test',
	siteUrl: 'https://prismatica.example',
	link: 'https://prismatica.example/auth/reset-password#token_hash=abc&type=recovery&exp=1800000000&sig=xyz',
	expiresIn: '60 minutes',
	changedAt: 'Thursday 15 October 2026 at 12:00 UTC',
};
const PALETTE = ['#F6F5F1', '#15151A', '#56565F', '#B93A0C'];

describe.each(Object.keys(MESSAGES))('message %s', (name) => {
	const message = renderMessage(dir, name, vars);

	it('matches its HTML and text snapshots', () => {
		expect(message.subject).toMatchSnapshot('subject');
		expect(message.html).toMatchSnapshot('html');
		expect(message.text).toMatchSnapshot('text');
	});

	it('is table-based, self-contained HTML under 30 KB in the site palette and system fonts', () => {
		expect(Buffer.byteLength(message.html)).toBeLessThan(30 * 1024);
		expect(message.html).toMatch(/^<!doctype html>/i);
		expect(message.html).toContain('role="presentation"');
		for (const colour of PALETTE) expect(message.html).toContain(colour);
		expect(message.html).toContain('-apple-system');
		expect(message.html).not.toMatch(/<link\b|<script\b|@import|@font-face|url\(/i);
		expect(message.html).not.toMatch(/\{\{|\}\}/);
		expect(message.text).not.toMatch(/\{\{|\}\}|<[a-z]/i);
	});

	it('links only to the configured site URL', () => {
		const hrefs = [...message.html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll('&amp;', '&'));
		expect(hrefs.length).toBeGreaterThan(0);
		for (const href of hrefs) expect(href.startsWith(`${vars.siteUrl}/`) || href === vars.siteUrl).toBe(true);
	});
});

describe('renderMessage', () => {
	it('escapes values in the HTML part and keeps them as typed in the text part', () => {
		const message = renderMessage(dir, 'accountExists', { ...vars, email: '"x"<y>&@arlet.test' });
		expect(message.html).toContain('&quot;x&quot;&lt;y&gt;&amp;@arlet.test');
		expect(message.html).not.toContain('"x"<y>');
		expect(message.text).toContain('"x"<y>&@arlet.test');
	});

	it('fails loudly on a variable the caller did not give, instead of mailing a blank', () => {
		expect(() => renderMessage(dir, 'confirmEmail', { email: 'a@b.test', siteUrl: 'https://s.example' })).toThrow(/link/);
	});

	it('refuses an unknown message name', () => {
		expect(() => renderMessage(dir, 'nope', vars)).toThrow(/Unknown message/);
	});

	it('puts the confirmation link in the confirm message', () => {
		const message = renderMessage(dir, 'confirmEmail', { ...vars, expiresIn: '24 hours' });
		expect(message.subject).toBe('Confirm your email');
		expect(message.text).toContain(vars.link);
		expect(message.html).toContain(vars.link.replaceAll('&', '&amp;'));
		expect(message.text).toContain('24 hours');
	});
});
