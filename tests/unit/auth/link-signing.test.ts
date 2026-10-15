// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildLinkUrl, checkLink, humanDuration, linkSigningKeyProblem, linkTtls, signLink } from '../../../scripts/auth/link-signing.mjs';

const KEY = 'k'.repeat(48);
const HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c';
const NOW = 1_800_000_000;

function fields(type: string, exp: number, key = KEY) {
	return { token_hash: HASH, type, exp: String(exp), sig: signLink(key, { type, tokenHash: HASH, exp }) };
}

describe('checkLink', () => {
	it('accepts a link signed with the key, before its exp', () => {
		expect(checkLink(KEY, 'signup', fields('signup', NOW + 60), NOW)).toEqual({ ok: true, tokenHash: HASH, exp: NOW + 60 });
	});

	it('refuses a link whose exp has passed, including the exact second', () => {
		expect(checkLink(KEY, 'signup', fields('signup', NOW - 1), NOW)).toEqual({ ok: false, reason: 'expired' });
		expect(checkLink(KEY, 'signup', fields('signup', NOW), NOW)).toEqual({ ok: false, reason: 'expired' });
	});

	it('refuses a tampered exp, token or signature', () => {
		const good = fields('recovery', NOW + 3600);
		expect(checkLink(KEY, 'recovery', { ...good, exp: String(NOW + 7200) }, NOW)).toMatchObject({ ok: false, reason: 'bad_signature' });
		expect(checkLink(KEY, 'recovery', { ...good, token_hash: HASH.replace('a1', 'b1') }, NOW)).toMatchObject({ ok: false, reason: 'bad_signature' });
		const flipped = good.sig.slice(0, -1) + (good.sig.endsWith('A') ? 'B' : 'A');
		expect(checkLink(KEY, 'recovery', { ...good, sig: flipped }, NOW)).toMatchObject({ ok: false, reason: 'bad_signature' });
	});

	it('refuses a link signed with another key', () => {
		expect(checkLink(KEY, 'signup', fields('signup', NOW + 60, 'z'.repeat(48)), NOW)).toMatchObject({ ok: false, reason: 'bad_signature' });
	});

	it('refuses a signup link presented as a recovery link (the type is inside the MAC)', () => {
		const signup = fields('signup', NOW + 60);
		expect(checkLink(KEY, 'recovery', { ...signup, type: 'recovery' }, NOW)).toMatchObject({ ok: false, reason: 'bad_signature' });
		expect(checkLink(KEY, 'recovery', signup, NOW)).toMatchObject({ ok: false, reason: 'malformed' });
	});

	it('refuses malformed fields without computing anything', () => {
		const good = fields('signup', NOW + 60);
		for (const bad of [{}, { ...good, exp: '1e12' }, { ...good, exp: '-5' }, { ...good, token_hash: 'short' }, { ...good, sig: '' }, { ...good, token_hash: `${HASH}\n` }]) {
			expect(checkLink(KEY, 'signup', bad, NOW)).toMatchObject({ ok: false, reason: 'malformed' });
		}
	});

	it('refuses everything when no key is configured', () => {
		expect(checkLink('', 'signup', fields('signup', NOW + 60), NOW)).toMatchObject({ ok: false, reason: 'unconfigured' });
	});
});

describe('buildLinkUrl', () => {
	it('puts the token in the fragment of the page for the type, from the configured site URL only', () => {
		const url = buildLinkUrl('https://prismatica.example/', KEY, { type: 'recovery', tokenHash: HASH, exp: NOW + 3600 });
		const parsed = new URL(url);
		expect(parsed.origin + parsed.pathname).toBe('https://prismatica.example/auth/reset-password');
		expect(parsed.search).toBe('');
		const fragment = new URLSearchParams(parsed.hash.slice(1));
		expect(Object.fromEntries(fragment)).toEqual({ token_hash: HASH, type: 'recovery', exp: String(NOW + 3600), sig: signLink(KEY, { type: 'recovery', tokenHash: HASH, exp: NOW + 3600 }) });
		expect(checkLink(KEY, 'recovery', Object.fromEntries(fragment), NOW).ok).toBe(true);
	});

	it('sends a signup link to the confirm page', () => {
		expect(buildLinkUrl('https://s.example', KEY, { type: 'signup', tokenHash: HASH, exp: NOW }).startsWith('https://s.example/auth/confirm#token_hash=')).toBe(true);
	});
});

describe('linkSigningKeyProblem', () => {
	it('names a missing, short or reused key, and accepts a dedicated one', () => {
		expect(linkSigningKeyProblem('', [])).toMatch(/AUTH_LINK_SIGNING_KEY is not set/);
		expect(linkSigningKeyProblem('x'.repeat(31), [])).toMatch(/at least 32/);
		expect(linkSigningKeyProblem(KEY, ['other', KEY])).toMatch(/reused/);
		expect(linkSigningKeyProblem(KEY, ['other', ''])).toBeNull();
	});
});

describe('linkTtls', () => {
	it('defaults to 24 h and 1 h', () => {
		expect(linkTtls({})).toEqual({ verifySec: 86_400, resetSec: 3_600 });
	});

	it('takes shorter values and never exceeds the ceilings', () => {
		expect(linkTtls({ AUTH_VERIFY_TOKEN_TTL_SEC: '600', AUTH_RESET_TOKEN_TTL_SEC: '5' })).toEqual({ verifySec: 600, resetSec: 5 });
		expect(linkTtls({ AUTH_VERIFY_TOKEN_TTL_SEC: '999999', AUTH_RESET_TOKEN_TTL_SEC: '7200' })).toEqual({ verifySec: 86_400, resetSec: 3_600 });
	});

	it('falls back to the default on a value that is not a positive integer', () => {
		expect(linkTtls({ AUTH_VERIFY_TOKEN_TTL_SEC: 'soon', AUTH_RESET_TOKEN_TTL_SEC: '0' })).toEqual({ verifySec: 86_400, resetSec: 3_600 });
	});
});

describe('humanDuration', () => {
	it('words a lifetime the way the mails print it', () => {
		expect(humanDuration(86_400)).toBe('24 hours');
		expect(humanDuration(3_600)).toBe('60 minutes');
		expect(humanDuration(600)).toBe('10 minutes');
		expect(humanDuration(5)).toBe('5 seconds');
		expect(humanDuration(7_200)).toBe('2 hours');
	});
});
