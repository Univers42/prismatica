import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readStorage, writeStorage } from '../../../src/lib/storage';
import { bindConsentBanner } from '../../../src/scripts/consent';
import { type ConsentPreferences, storeConsentPreferences, readConsentPreferences } from '../../../src/scripts/consent';

describe('Consent Preferences', () => {
	afterEach(() => {
		globalThis.localStorage.clear();
	});

	describe('readConsentPreferences', () => {
		it('returns null when storage is empty', () => {
			expect(readConsentPreferences()).toBeNull();
		});

		it('recovers the stored object correctly', () => {
			const preferences: ConsentPreferences = {
				analytics: true,
				newsletter: false,
				marketing: true,
				policyVersion: '1.1.0',
				savedAt: new Date().toISOString(),
			};
			writeStorage('prismatica-consent-v1', JSON.stringify(preferences));
			expect(readConsentPreferences()).toEqual(preferences);
		});
	});

	describe('storeConsentPreferences', () => {
		it('saves record with current policy version and ISO timestamp', () => {
			const preferences = storeConsentPreferences({ analytics: true, newsletter: false, marketing: true });
			expect(preferences.analytics).toBe(true);
			expect(preferences.newsletter).toBe(false);
			expect(preferences.marketing).toBe(true);
			expect(preferences.policyVersion).toBe('1.1.0');
			expect(preferences.savedAt).toBeTypeOf('string');
			const saved = readStorage('prismatica-consent-v1');
			expect(saved).toBeTruthy();
			const parsed = JSON.parse(saved!) as ConsentPreferences;
			expect(parsed).toEqual(preferences);
		});
	});

	describe('bindConsentBanner', () => {
		beforeEach(() => {
			document.body.innerHTML = `
				<section data-consent-banner hidden tabindex="-1">
					<button type="button" data-consent-accept-all>Accept all</button>
					<button type="button" data-consent-reject-all>Reject all</button>
					<button type="button" data-consent-manage aria-expanded="false">Manage</button>
					<form data-consent-form hidden>
						<input type="checkbox" name="analytics">
						<input type="checkbox" name="newsletter">
						<input type="checkbox" name="marketing">
						<button type="submit">Save</button>
					</form>
				</section>
				<button type="button" data-manage-cookies>Cookie settings</button>
			`;
		});
		it('restores saved choices and opens the preferences form', () => {
			storeConsentPreferences({ analytics: true, newsletter: false, marketing: true });
			bindConsentBanner();
			(document.querySelector('[data-manage-cookies]') as HTMLButtonElement).click();
			const form = document.querySelector('[data-consent-form]') as HTMLFormElement;
			expect((form.elements.namedItem('analytics') as HTMLInputElement).checked).toBe(true);
			expect((form.elements.namedItem('newsletter') as HTMLInputElement).checked).toBe(false);
			expect((form.elements.namedItem('marketing') as HTMLInputElement).checked).toBe(true);
			expect(form.hidden).toBe(false);
		});
	});

});
