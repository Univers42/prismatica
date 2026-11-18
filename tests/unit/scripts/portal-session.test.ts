import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ACCESS_TOKEN_KEY,
	clearAccessToken,
	getAccessToken,
	setAccessToken,
	syncStoredConsents,
} from '../../../src/scripts/portal-session';

describe('portal-session module', () => {
	afterEach(() => {
		sessionStorage.clear();
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it('manages access token lifecycle in session storage', () => {
		expect(getAccessToken()).toBeNull();

		setAccessToken('test-jwt-token-abc');
		expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe('test-jwt-token-abc');
		expect(getAccessToken()).toBe('test-jwt-token-abc');

		clearAccessToken();
		expect(getAccessToken()).toBeNull();
		expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
	});

	it('syncs newsletter consent with a single fetch when consent is stored', async () => {
		const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		// No email -> no fetch
		await syncStoredConsents('tok', undefined);
		expect(fetchMock).not.toHaveBeenCalled();

		// Consent in preferences -> 1 fetch call
		localStorage.setItem('prismatica_consent_preferences', JSON.stringify({ newsletter: true }));
		await syncStoredConsents('tok', 'user@example.com');
		expect(fetchMock).toHaveBeenCalledTimes(1);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('/api/newsletter/subscribe');
		expect(JSON.parse(String(init.body))).toEqual({
			email: 'user@example.com',
			newsletter_consent: true,
		});

		// Both preferences and newsletter intent set -> still only 1 fetch call (no duplicates)
		fetchMock.mockClear();
		sessionStorage.setItem('prismatica_newsletter_intent', 'true');
		await syncStoredConsents('tok', 'user@example.com');
		expect(fetchMock).toHaveBeenCalledTimes(1);

		vi.unstubAllGlobals();
	});
});