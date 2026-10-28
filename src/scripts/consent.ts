import { CONSENT_MAX_AGE_MONTHS, CONSENT_STORAGE_KEY, POLICY_VERSION } from '../data/legal';
import { readStorage, writeStorage } from '../lib/storage';
import { queryElement, queryElements, isButton, isHtmlElement } from '../lib/dom-utils';
import { announce } from './theme';

export type ConsentPreferences = {
	analytics: boolean;
	newsletter: boolean;
	marketing: boolean;
	policyVersion: string;
	savedAt: string;
};

type ConsentChoices = Pick<ConsentPreferences, 'analytics' | 'newsletter' | 'marketing'>;

function isConsentPreferences(value: unknown): value is ConsentPreferences {
	if (!value || typeof value !== 'object') return false;
	const record = value as Partial<ConsentPreferences>;
	return typeof record.analytics === 'boolean'
		&& typeof record.newsletter === 'boolean'
		&& typeof record.marketing === 'boolean'
		&& typeof record.policyVersion === 'string'
		&& typeof record.savedAt === 'string';
}

export function storeConsentPreferences(preferences: ConsentChoices): ConsentPreferences {
	const record: ConsentPreferences = {
		analytics: preferences.analytics,
		newsletter: preferences.newsletter,
		marketing: preferences.marketing,
		policyVersion: POLICY_VERSION,
		savedAt: new Date().toISOString(),
	};
	writeStorage(CONSENT_STORAGE_KEY, JSON.stringify(record));
	return record;
}

export function readConsentPreferences(): ConsentPreferences | null {
	const raw = readStorage(CONSENT_STORAGE_KEY);
	if (!raw) return null;
	try {
		const value: unknown = JSON.parse(raw);
		return isConsentPreferences(value) ? value : null;
	} catch {
		return null;
	}
}

/**
 * A stored choice stops counting as valid consent once the policy it was given
 * against changes, or once it is older than CONSENT_MAX_AGE_MONTHS. The banner
 * then asks again, pre-filled with the previous answers.
 */
export function needsConsentRenewal(preferences: ConsentPreferences | null, now: Date = new Date()): boolean {
	if (!preferences) return true;
	if (preferences.policyVersion !== POLICY_VERSION) return true;
	const savedAt = new Date(preferences.savedAt);
	if (Number.isNaN(savedAt.getTime()) || savedAt.getTime() > now.getTime()) return true;
	const expiresAt = new Date(savedAt);
	expiresAt.setMonth(expiresAt.getMonth() + CONSENT_MAX_AGE_MONTHS);
	return now.getTime() >= expiresAt.getTime();
}

/** Valid, current consent for one optional category; false when consent is missing or stale. */
export function hasConsent(category: keyof ConsentChoices): boolean {
	const preferences = readConsentPreferences();
	return !needsConsentRenewal(preferences) && preferences?.[category] === true;
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

	const applyPreferencesToForm = (preferences: ConsentPreferences | null): void => {
		if (!(form instanceof HTMLFormElement)) return;
		for (const category of ['analytics', 'newsletter', 'marketing'] as const) {
			const input = form.elements.namedItem(category);
			if (input instanceof HTMLInputElement) input.checked = preferences?.[category] ?? false;
		}
	};

	if (typeof ResizeObserver !== 'undefined') {
		new ResizeObserver(([entry]) => {
			document.documentElement.style.setProperty('--consent-banner-height', `${entry?.borderBoxSize[0]?.blockSize ?? 0}px`);
		}).observe(banner);
	}

	const save = (analytics: boolean, newsletter: boolean, marketing: boolean): void => {
		storeConsentPreferences({ analytics, newsletter, marketing });
		hideBanner();
		document.dispatchEvent(new CustomEvent('prismatica:consent-changed', { detail: { analytics, newsletter, marketing } }));
		announce('Consent preferences saved.');
	};

	const storedPreferences = readConsentPreferences();
	if (needsConsentRenewal(storedPreferences)) {
		showBanner();
		announce('Privacy choices: choose your consent preferences.');
	}
	applyPreferencesToForm(storedPreferences);

	queryElements('[data-manage-cookies]', isButton).forEach((button) => button.addEventListener('click', () => {
		applyPreferencesToForm(readConsentPreferences());
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
			save(
				analytics instanceof HTMLInputElement && analytics.checked,
				newsletter instanceof HTMLInputElement && newsletter.checked,
				marketing instanceof HTMLInputElement && marketing.checked,
			);
		});
	}

	acceptAll?.addEventListener('click', () => save(true, true, true));
	rejectAll?.addEventListener('click', () => save(false, false, false));
}
