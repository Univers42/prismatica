import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('oauth-providers', () => {
	beforeEach(() => vi.restoreAllMocks());

	it('parses comma separated providers', async () => {
		const { parseOAuthProviders } = await import('../../../src/lib/oauth-providers');
		expect(parseOAuthProviders('google, github, fortytwo')).toEqual(['google', 'github', 'fortytwo']);
	});

	it('ignores unknown providers with a warning', async () => {
		const { parseOAuthProviders } = await import('../../../src/lib/oauth-providers');
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		expect(parseOAuthProviders('google, apple')).toEqual(['google']);
		expect(warn).toHaveBeenCalled();
	});

	it('returns empty for null/empty', async () => {
		const { parseOAuthProviders } = await import('../../../src/lib/oauth-providers');
		expect(parseOAuthProviders('')).toEqual([]);
		expect(parseOAuthProviders(null)).toEqual([]);
	});

	it('isOAuthProviderEnabled checks list', async () => {
		const { isOAuthProviderEnabled } = await import('../../../src/lib/oauth-providers');
		expect(isOAuthProviderEnabled('google', 'google,github')).toBe(true);
		expect(isOAuthProviderEnabled('fortytwo', 'google,github')).toBe(false);
	});
});
