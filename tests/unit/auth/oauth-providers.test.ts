import { describe, expect, it } from 'vitest';
import { enabledOauthProviders, isS256Challenge, oauthAuthorizeUrl } from '../../../scripts/auth/oauth-providers.mjs';

const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('enabledOauthProviders', () => {
	it('lists the providers GoTrue enables, in a fixed order', () => {
		expect(enabledOauthProviders({ mailer_autoconfirm: false, external: { github: true, google: true, email: true } })).toEqual(['google', 'github']);
		expect(enabledOauthProviders({ mailer_autoconfirm: false, external: { google: true, github: false } })).toEqual(['google']);
	});

	it('ignores providers the site does not offer and non-boolean flags', () => {
		expect(enabledOauthProviders({ mailer_autoconfirm: false, external: { fortytwo: true, google: 'true' } })).toEqual([]);
	});

	it('is empty for missing settings or a missing external map', () => {
		expect(enabledOauthProviders(null)).toEqual([]);
		expect(enabledOauthProviders({ mailer_autoconfirm: false })).toEqual([]);
	});
});

describe('isS256Challenge', () => {
	it('accepts only a 43-char base64url string', () => {
		expect(isS256Challenge(CHALLENGE)).toBe(true);
		expect(isS256Challenge(CHALLENGE.slice(1))).toBe(false);
		expect(isS256Challenge(`${CHALLENGE}A`)).toBe(false);
		expect(isS256Challenge(`${CHALLENGE.slice(1)}=`)).toBe(false);
		expect(isS256Challenge(`${CHALLENGE.slice(1)}+`)).toBe(false);
		expect(isS256Challenge(undefined)).toBe(false);
	});
});

describe('oauthAuthorizeUrl', () => {
	it('starts PKCE on the site host and returns to its callback page', () => {
		const url = new URL(oauthAuthorizeUrl({ siteUrl: 'https://site.test/', anonKey: 'anon', provider: 'google', codeChallenge: CHALLENGE }));
		expect(`${url.origin}${url.pathname}`).toBe('https://site.test/auth/v1/authorize');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			provider: 'google',
			apikey: 'anon',
			redirect_to: 'https://site.test/auth/callback',
			code_challenge: CHALLENGE,
			code_challenge_method: 's256',
		});
	});

	it('asks GitHub for the verified email scope', () => {
		const url = new URL(oauthAuthorizeUrl({ siteUrl: 'https://site.test', anonKey: 'anon', provider: 'github', codeChallenge: CHALLENGE }));
		expect(url.searchParams.get('scopes')).toBe('read:user user:email');
	});
});
