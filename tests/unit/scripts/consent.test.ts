import { describe, it, expect, afterEach } from 'vitest';
import { readStorage, writeStorage } from '../../../src/lib/storage';
import { CONSENT_MAX_AGE_MONTHS, CONSENT_STORAGE_KEY, POLICY_VERSION } from '../../../src/data/legal';
import { type ConsentPreferences, storeConsentPreferences, readConsentPreferences, bindConsentBanner, needsConsentRenewal, hasConsent } from '../../../src/scripts/consent';

describe('Consent Preferences', () => {
	afterEach(() => {
		globalThis.localStorage.clear();
		document.body.innerHTML = '';
	});

	describe('readConsentPreferences', () => {
		it('returns null when storage is empty', () => {
			expect(readConsentPreferences()).toBeNull();
		});

		it('recovers the stored object correctly', () => {
			const preferences: ConsentPreferences = {
				analytics: true, newsletter: false, marketing: true,
				policyVersion: POLICY_VERSION, savedAt: new Date().toISOString(),
			};
			writeStorage(CONSENT_STORAGE_KEY, JSON.stringify(preferences));
			expect(readConsentPreferences()).toEqual(preferences);
		});

		it('rejects malformed or incomplete stored values', () => {
			writeStorage(CONSENT_STORAGE_KEY, JSON.stringify({ analytics: true }));
			expect(readConsentPreferences()).toBeNull();
			writeStorage(CONSENT_STORAGE_KEY, '{broken json');
			expect(readConsentPreferences()).toBeNull();
		});
	});

	describe('storeConsentPreferences', () => {
		it('saves record with current policy version and ISO timestamp', () => {
			const preferences = storeConsentPreferences({ analytics: true, newsletter: false, marketing: true });
			expect(preferences).toMatchObject({ analytics: true, newsletter: false, marketing: true, policyVersion: POLICY_VERSION });
			expect(preferences.savedAt).toBeTypeOf('string');
			expect(JSON.parse(readStorage(CONSENT_STORAGE_KEY)!) as ConsentPreferences).toEqual(preferences);
		});
	});

	describe('needsConsentRenewal', () => {
		const record = (overrides: Partial<ConsentPreferences> = {}): ConsentPreferences => ({
			analytics: true, newsletter: true, marketing: false,
			policyVersion: POLICY_VERSION, savedAt: '2026-01-15T10:00:00.000Z', ...overrides,
		});

		it('asks when no choice is stored', () => {
			expect(needsConsentRenewal(null)).toBe(true);
		});

		it('keeps a current choice younger than the maximum age', () => {
			expect(needsConsentRenewal(record(), new Date('2026-07-14T10:00:00.000Z'))).toBe(false);
		});

		it('asks again once the choice is six months old', () => {
			expect(CONSENT_MAX_AGE_MONTHS).toBe(6);
			expect(needsConsentRenewal(record(), new Date('2026-07-15T10:00:00.000Z'))).toBe(true);
		});

		it('asks again when the policy version changed', () => {
			expect(needsConsentRenewal(record({ policyVersion: '0.9.0' }), new Date('2026-01-16T10:00:00.000Z'))).toBe(true);
		});

		it('asks again when the timestamp is invalid or in the future', () => {
			expect(needsConsentRenewal(record({ savedAt: 'yesterday' }), new Date('2026-01-16T10:00:00.000Z'))).toBe(true);
			expect(needsConsentRenewal(record({ savedAt: '2027-01-01T00:00:00.000Z' }), new Date('2026-01-16T10:00:00.000Z'))).toBe(true);
		});

		it('treats stale consent as no consent for optional categories', () => {
			writeStorage(CONSENT_STORAGE_KEY, JSON.stringify(record({ policyVersion: '0.9.0' })));
			expect(hasConsent('analytics')).toBe(false);
			storeConsentPreferences({ analytics: true, newsletter: false, marketing: false });
			expect(hasConsent('analytics')).toBe(true);
			expect(hasConsent('newsletter')).toBe(false);
		});
	});

	describe('consent banner', () => {
		function renderBanner(): void {
			document.body.innerHTML = `
				<section data-consent-banner hidden>
					<button type="button" data-consent-accept-all>Accept all</button>
					<button type="button" data-consent-reject-all>Reject all</button>
					<button type="button" data-consent-manage aria-expanded="false">Manage preferences</button>
					<form data-consent-form hidden>
						<input type="checkbox" name="analytics">
						<input type="checkbox" name="newsletter">
						<input type="checkbox" name="marketing">
						<button type="submit">Save</button>
					</form>
				</section>
				<button type="button" data-manage-cookies>Manage cookie preferences</button>
				<div id="global-announcer" aria-live="polite"></div>
			`;
		}

		it('restores previously saved choices when reopened', () => {
			storeConsentPreferences({ analytics: true, newsletter: false, marketing: true });
			renderBanner();
			bindConsentBanner();
			(document.querySelector('[data-manage-cookies]') as HTMLButtonElement).click();
			expect((document.querySelector('[name="analytics"]') as HTMLInputElement).checked).toBe(true);
			expect((document.querySelector('[name="newsletter"]') as HTMLInputElement).checked).toBe(false);
			expect((document.querySelector('[name="marketing"]') as HTMLInputElement).checked).toBe(true);
			expect(document.querySelector('[data-consent-banner]')?.hasAttribute('hidden')).toBe(false);
		});

		it('rejects optional choices by default and saves form state', () => {
			renderBanner();
			bindConsentBanner();
			expect(document.querySelector('[data-consent-banner]')?.hasAttribute('hidden')).toBe(false);
			(document.querySelector('[data-consent-manage]') as HTMLButtonElement).click();
			(document.querySelector('[name="analytics"]') as HTMLInputElement).checked = true;
			document.querySelector('[data-consent-form]')!.dispatchEvent(new Event('submit', { cancelable: true }));
			expect(readConsentPreferences()).toMatchObject({ analytics: true, newsletter: false, marketing: false });
			expect(document.querySelector('[data-consent-banner]')?.hasAttribute('hidden')).toBe(true);
		});

		it('stays hidden for a current choice and reappears, pre-filled, for an outdated one', () => {
			storeConsentPreferences({ analytics: false, newsletter: true, marketing: false });
			renderBanner();
			bindConsentBanner();
			expect(document.querySelector('[data-consent-banner]')?.hasAttribute('hidden')).toBe(true);

			writeStorage(CONSENT_STORAGE_KEY, JSON.stringify({ analytics: false, newsletter: true, marketing: false, policyVersion: '0.9.0', savedAt: new Date().toISOString() }));
			renderBanner();
			bindConsentBanner();
			expect(document.querySelector('[data-consent-banner]')?.hasAttribute('hidden')).toBe(false);
			expect((document.querySelector('[name="newsletter"]') as HTMLInputElement).checked).toBe(true);
		});

		it('withdraws every optional category with reject all', () => {
			storeConsentPreferences({ analytics: true, newsletter: true, marketing: true });
			renderBanner();
			bindConsentBanner();
			(document.querySelector('[data-consent-reject-all]') as HTMLButtonElement).click();
			expect(readConsentPreferences()).toMatchObject({ analytics: false, newsletter: false, marketing: false });
		});
	});
});
