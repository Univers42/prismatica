import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { reflectAuthState, rehydrateAndReflectAuth, bindLogoutControls } from './auth-ui';

describe('Auth UI', () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<div data-auth-only id="auth-element">Secret</div>
			<div data-anon-only id="anon-element">Public</div>
			<button data-logout id="logout-btn">Log out</button>
		`;
		document.documentElement.dataset.authState = '';
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('reflectAuthState', () => {
		it('shows auth elements and hides anon elements when logged in', () => {
			reflectAuthState(true);

			const authEl = document.getElementById('auth-element');
			const anonEl = document.getElementById('anon-element');

			expect(authEl?.hidden).toBe(false);
			expect(anonEl?.hidden).toBe(true);
			expect(document.documentElement.dataset.authState).toBe('authenticated');
		});

		it('shows anon elements and hides auth elements when logged out', () => {
			reflectAuthState(false);

			const authEl = document.getElementById('auth-element');
			const anonEl = document.getElementById('anon-element');

			expect(authEl?.hidden).toBe(true);
			expect(anonEl?.hidden).toBe(false);
			expect(document.documentElement.dataset.authState).toBe('anonymous');
		});
	});

	describe('rehydrateAndReflectAuth', () => {
		it('reflects state based on rehydrateSession result', async () => {
			const rehydrateMock = vi.fn().mockResolvedValue(true);
			await rehydrateAndReflectAuth(rehydrateMock);

			expect(rehydrateMock).toHaveBeenCalled();
			expect(document.documentElement.dataset.authState).toBe('authenticated');
		});
	});

	describe('bindLogoutControls', () => {
		it('logs out successfully and updates UI', async () => {
			const logoutMock = vi.fn().mockResolvedValue(undefined);
			const announceMock = vi.fn();

			// Pre-set authenticated state
			reflectAuthState(true);
			bindLogoutControls(logoutMock, announceMock);

			const btn = document.getElementById('logout-btn') as HTMLButtonElement;
			btn.click();

			// Wait for promise chain
			await vi.waitFor(() => {
				expect(logoutMock).toHaveBeenCalled();
				expect(announceMock).toHaveBeenCalledWith('You have been signed out.');
				expect(document.documentElement.dataset.authState).toBe('anonymous');
			});
		});

		it('does NOT update UI if logoutSession rejects (Devil Condition 1)', async () => {
			// Mock a rejected logout request (e.g., network failure)
			const logoutMock = vi.fn().mockRejectedValue(new Error('Network drop'));
			const announceMock = vi.fn();

			// Pre-set authenticated state
			reflectAuthState(true);
			bindLogoutControls(logoutMock, announceMock);

			const btn = document.getElementById('logout-btn') as HTMLButtonElement;
			btn.click();

			// Ensure promise rejection has time to settle
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(logoutMock).toHaveBeenCalled();
			expect(announceMock).not.toHaveBeenCalled();
			// The UI MUST remain authenticated
			expect(document.documentElement.dataset.authState).toBe('authenticated');
		});
	});
});
