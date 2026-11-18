import { readStorage } from '../lib/storage';
import { readConsentPreferences } from './consent';
import { NEWSLETTER_INTENT_KEY } from '../data/legal';

export const ACCESS_TOKEN_KEY = 'auth_token';

export function getAccessToken(): string | null {
	return readStorage(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
	if (token) {
		sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
	} else {
		sessionStorage.removeItem(ACCESS_TOKEN_KEY);
	}
}

export function clearAccessToken(): void {
	setAccessToken(null);
}

export async function syncStoredConsents(_token: string, email?: string): Promise<void> {
	const preferences = readConsentPreferences();
	if (preferences?.newsletter && email) {
		await fetch('/api/newsletter/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, newsletter_consent: true }),
		}).catch(() => undefined);
	}
	const newsletterIntent = readStorage(NEWSLETTER_INTENT_KEY);
	if (newsletterIntent && email) {
		await fetch('/api/newsletter/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, newsletter_consent: true }),
		}).catch(() => undefined);
	}
}