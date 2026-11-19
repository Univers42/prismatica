import { readStorage } from '../lib/storage';
import { readConsentPreferences } from './consent';
import { NEWSLETTER_INTENT_KEY } from '../data/legal';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
	return accessToken;
}

export function setAccessToken(token: string | null): void {
	accessToken = token && token.length > 0 ? token : null;
}

export function clearAccessToken(): void {
	accessToken = null;
}

export async function syncStoredConsents(_token: string, email?: string): Promise<void> {
	if (!email) return;
	const preferences = readConsentPreferences();
	const newsletterIntent = readStorage(NEWSLETTER_INTENT_KEY);
	const wantsNewsletter = Boolean(preferences?.newsletter || newsletterIntent);
	if (wantsNewsletter) {
		await fetch('/api/newsletter/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, newsletter_consent: true }),
		}).catch(() => undefined);
	}
}