import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readStorage, writeStorage } from '../../../src/lib/storage';
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
});