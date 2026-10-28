import { CONSENT_STORAGE_KEY, POLICY_VERSION } from '../data/legal';
import { readStorage, writeStorage } from '../lib/storage';
import { queryElement, queryElements, isButton, isHtmlElement } from '../lib/dom-utils';
import { announce } from './theme';
import { baasConfig } from '../lib/baas-config';
import { getAccessToken } from './portal';

export type ConsentPreferences = {
	analytics: boolean;
	newsletter: boolean;
	marketing: boolean;
	policyVersion: string;
	savedAt: string;
};

type StoredConsentPreferences = ConsentPreferences & {
	revision: number;
};

export function storeConsentPreferences(
	preferences: Omit<ConsentPreferences, 'policyVersion' | 'savedAt'>,
): ConsentPreferences {
	const previous = readConsentPreferences() as (ConsentPreferences & { revision?: number }) | null;
	const record: StoredConsentPreferences = {
		...preferences,
		policyVersion: POLICY_VERSION,
		savedAt: new Date().toISOString(),
		revision: (previous?.revision ?? 0) + 1,
	};
	writeStorage(CONSENT_STORAGE_KEY, JSON.stringify(record));
	return record;
}

export function readConsentPreferences(): ConsentPreferences | null {
	const raw = readStorage(CONSENT_STORAGE_KEY);
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return null;
		const candidate = parsed as Partial<ConsentPreferences>;
		if (
			typeof candidate.analytics !== 'boolean' ||
			typeof candidate.newsletter !== 'boolean' ||
			typeof candidate.marketing !== 'boolean' ||
			typeof candidate.policyVersion !== 'string' ||
			typeof candidate.savedAt !== 'string'
		) return null;
		return candidate as ConsentPreferences;
	} catch {
		return null;
	}
}

export function bindConsentBanner(): void {
	const banner = queryElement('[data-consent-banner]', isHtmlElement);
	if (!banner) return;

	const form = banner.querySelector('[data-consent-form]');
	const manageButton = banner.querySelector('[data-consent-manage]');
	const acceptAll = banner.querySelector('[data-consent-accept-all]');
	const rejectAll = banner.querySelector('[data-consent-reject-all]');
	const showBanner = (): void => banner.removeAttribute('hidden');
	const hideBanner = (): void => banner.setAttribute('hidden', '');

	if (typeof ResizeObserver !== 'undefined') {
		new ResizeObserver(([entry]) => {
			document.documentElement.style.setProperty('--consent-banner-height', `${entry?.borderBoxSize[0]?.blockSize ?? 0}px`);
		}).observe(banner);
	}

	const save = async (analytics: boolean, newsletter: boolean, marketing: boolean): Promise<void> => {
		const preferences = { analytics, newsletter, marketing };
		const previous = readConsentPreferences();
		storeConsentPreferences(preferences);

		// Persist each choice in the Grobase GDPR service whenever the user is
		// authenticated. Local preferences remain available if the service is offline.
		const token = getAccessToken();
		if (token) {
			const entries = [
				['analytics', analytics],
				['newsletter', newsletter],
				['marketing', marketing],
			] as const;
			try {
				const results = await Promise.all(entries.map(async ([type, consented]) => {
					const response = await fetch(`${baasConfig.url}/gdpr/consents`, {
						method: 'POST',
						headers: {
							apikey: baasConfig.anonKey,
							Authorization: `Bearer ${token}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ consent_type: type, consented }),
					});
					return response.ok;
				}));
				if (results.some((ok) => !ok)) {
					announce('Preferences saved on this device. Some server consent records could not be updated.');
				} else {
					announce('Consent preferences saved.');
				}
			} catch {
				announce('Preferences saved on this device. Server consent records could not be updated.');
			}
		} else {
			announce('Consent preferences saved on this device. Sign in to sync them to your account.');
		}
		hideBanner();
	};

	if (!readConsentPreferences()) {
		showBanner();
		announce('Privacy choices: choose your consent preferences.');
	}

	queryElements('[data-manage-cookies]', isButton).forEach((button) => button.addEventListener('click', () => {
		const saved = readConsentPreferences();
		if (form instanceof HTMLFormElement) {
			const analytics = form.elements.namedItem('analytics');
			const newsletter = form.elements.namedItem('newsletter');
			const marketing = form.elements.namedItem('marketing');
			if (analytics instanceof HTMLInputElement) analytics.checked = saved?.analytics ?? false;
			if (newsletter instanceof HTMLInputElement) newsletter.checked = saved?.newsletter ?? false;
			if (marketing instanceof HTMLInputElement) marketing.checked = saved?.marketing ?? false;
			form.hidden = false;
		}
		if (manageButton instanceof HTMLButtonElement) manageButton.setAttribute('aria-expanded', 'true');
		showBanner();
		banner.focus({ preventScroll: false });
	}));

	if (manageButton instanceof HTMLButtonElement && form instanceof HTMLFormElement) {
		manageButton.addEventListener('click', () => {
			const isExpanded = manageButton.getAttribute('aria-expanded') === 'true';
			manageButton.setAttribute('aria-expanded', String(!isExpanded));
			form.hidden = isExpanded;
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const analytics = form.elements.namedItem('analytics');
			const newsletter = form.elements.namedItem('newsletter');
			const marketing = form.elements.namedItem('marketing');
			void save(
				analytics instanceof HTMLInputElement && analytics.checked,
				newsletter instanceof HTMLInputElement && newsletter.checked,
				marketing instanceof HTMLInputElement && marketing.checked,
			);
		});
	}

	acceptAll?.addEventListener('click', () => { void save(true, true, true); });
	rejectAll?.addEventListener('click', () => { void save(false, false, false); });
}