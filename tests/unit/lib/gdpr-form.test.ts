import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { bindDataRightsForm, bindGdprSelfService } from '../../../src/lib/gdpr-form';

describe('GDPR Form', () => {
	let mockReadStorage: ReturnType<typeof vi.fn>;
	let mockWriteStorage: ReturnType<typeof vi.fn>;
	let mockCallGdprRpc: ReturnType<typeof vi.fn>;
	const originalCrypto = globalThis.crypto;

	beforeEach(() => {
		document.body.innerHTML = `
			<form data-gdpr-request-form>
				<input type="hidden" data-csrf-token name="csrf" value="">
				<input name="request_type" value="delete">
				<input name="email" value="test@example.com">
				<input name="message" value="Please delete">
				<output data-gdpr-request-status></output>
				<button type="submit">Submit</button>
			</form>
		`;

		mockReadStorage = vi.fn().mockReturnValue(null);
		mockWriteStorage = vi.fn();
		mockCallGdprRpc = vi.fn().mockResolvedValue({ ok: true });

		// Ensure crypto is present by default for standard tests
		Object.defineProperty(globalThis, 'crypto', {
			value: {
				randomUUID: vi.fn().mockReturnValue('mock-uuid-1234')
			},
			configurable: true
		});
	});

	afterEach(() => {
		Object.defineProperty(globalThis, 'crypto', {
			value: originalCrypto,
			configurable: true
		});
		vi.restoreAllMocks();
	});

	it('explains that generic rights requests must use the privacy contact', () => {
		bindDataRightsForm({
			readStorage: mockReadStorage,
			writeStorage: mockWriteStorage,
			csrfStorageKey: 'CSRF_KEY',
			policyVersion: '1.0',
			privacyContact: 'privacy@example.com',
		});

		expect(mockCallGdprRpc).not.toHaveBeenCalled();
		expect(document.querySelector('[data-gdpr-request-status]')?.textContent).toContain('privacy@example.com');
		expect(document.querySelector('form button[type="submit"]')).toHaveProperty('disabled', true);
	});

	it('falls back safely if crypto.randomUUID is undefined (Devil Condition 1)', () => {
		// Simulate HTTP/non-secure context
		Object.defineProperty(globalThis, 'crypto', {
			value: { randomUUID: undefined },
			configurable: true
		});

		// Should not throw
		expect(() => {
			bindDataRightsForm({
				readStorage: mockReadStorage,
				writeStorage: mockWriteStorage,
				callGdprRpc: mockCallGdprRpc,
				csrfStorageKey: 'CSRF_KEY',
				policyVersion: '1.0'
			});
		}).not.toThrow();

		// Should have generated a fallback token and written it
		expect(mockWriteStorage).toHaveBeenCalled();
		const writtenToken = mockWriteStorage.mock.calls[0][1];
		expect(writtenToken).toBeTruthy();
		expect(typeof writtenToken).toBe('string');
		expect(writtenToken.length).toBeGreaterThan(0);
	});

	describe('GDPR self-service actions', () => {
		beforeEach(() => {
			document.body.innerHTML = `
				<section data-gdpr-self-service>
					<button type="button" data-gdpr-export>Export my data</button>
					<button type="button" data-gdpr-delete>Request deletion</button>
					<output data-gdpr-self-service-status></output>
				</section>
			`;
			vi.spyOn(window, 'confirm').mockReturnValue(true);
		});

		it('downloads a scoped export returned by the authenticated export RPC', async () => {
			const payload = { user: { email: 'test@example.com' }, preferences: { theme: 'dark' } };
			const rpc = vi.fn().mockResolvedValue({ ok: true, data: payload });
			const endpoint = vi.fn().mockResolvedValue({ ok: true, data: payload });
			const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
			const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
			bindGdprSelfService({ callGdprRpc: rpc, callGdprEndpoint: endpoint });

			(document.querySelector('[data-gdpr-export]') as HTMLButtonElement).click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(endpoint).toHaveBeenCalledWith('/gdpr/v1/export', 'GET');
			expect(rpc).not.toHaveBeenCalled();
			expect(click).toHaveBeenCalledOnce();
			expect(revoke).toHaveBeenCalledOnce();
			expect(document.querySelector('[data-gdpr-self-service-status]')?.textContent).toContain('downloaded');
		});

		it('asks for confirmation before requesting account deletion', async () => {
			const rpc = vi.fn();
			const endpoint = vi.fn().mockResolvedValue({ ok: true, data: { id: 1, status: 'pending' } });
			bindGdprSelfService({ callGdprRpc: rpc, callGdprEndpoint: endpoint });

			(document.querySelector('[data-gdpr-delete]') as HTMLButtonElement).click();
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(window.confirm).toHaveBeenCalledOnce();
			expect(endpoint).toHaveBeenCalledWith('/gdpr/v1/deletion-requests', 'POST', {});
			expect(rpc).not.toHaveBeenCalled();
			expect(document.querySelector('[data-gdpr-self-service-status]')?.textContent).toContain('submitted');
		});

		it('does not request deletion when confirmation is cancelled', async () => {
			vi.spyOn(window, 'confirm').mockReturnValue(false);
			const rpc = vi.fn();
			const endpoint = vi.fn();
			bindGdprSelfService({ callGdprRpc: rpc, callGdprEndpoint: endpoint });

			(document.querySelector('[data-gdpr-delete]') as HTMLButtonElement).click();

			expect(rpc).not.toHaveBeenCalled();
			expect(endpoint).not.toHaveBeenCalled();
		});
	});

});
