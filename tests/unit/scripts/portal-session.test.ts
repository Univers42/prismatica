import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ACCESS_TOKEN_KEY,
	clearAccessToken,
	getAccessToken,
	setAccessToken,
	syncStoredConsents,
} from '../../../src/scripts/portal-session';
import { CONSENT_STORAGE_KEY, NEWSLETTER_INTENT_KEY, POLICY_VERSION } from '../../../src/data/legal';

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
		localStorage.setItem(
			CONSENT_STORAGE_KEY,
			JSON.stringify({
				analytics: false,
				newsletter: true,
				marketing: false,
				policyVersion: POLICY_VERSION,
				savedAt: new Date().toISOString(),
			}),
		);
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
		localStorage.setItem(NEWSLETTER_INTENT_KEY, 'true');
		await syncStoredConsents('tok', 'user@example.com');
		expect(fetchMock).toHaveBeenCalledTimes(1);

		// Neither set -> 0 fetch calls
		localStorage.clear();
		fetchMock.mockClear();
		await syncStoredConsents('tok', 'user@example.com');
		expect(fetchMock).not.toHaveBeenCalled();

		vi.unstubAllGlobals();
	});
});