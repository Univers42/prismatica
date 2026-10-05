import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { bindDataRightsForm } from '../../../src/lib/gdpr-form';

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

	it('submits successfully when CSRF token matches', async () => {
		bindDataRightsForm({
			readStorage: mockReadStorage,
			writeStorage: mockWriteStorage,
			callGdprRpc: mockCallGdprRpc,
			csrfStorageKey: 'CSRF_KEY',
			policyVersion: '1.0'
		});

		expect(mockWriteStorage).toHaveBeenCalledWith('CSRF_KEY', 'mock-uuid-1234');

		const form = document.querySelector('form')!;
		// Simulate successful submit
		form.dispatchEvent(new Event('submit', { cancelable: true }));

		// Wait for promise resolution
		await new Promise(resolve => setTimeout(resolve, 10));

		expect(mockCallGdprRpc).toHaveBeenCalledWith('gdpr_submit_request', {
			request_type: 'delete',
			email: 'test@example.com',
			details: {
				message: 'Please delete',
				csrf: 'mock-uuid-1234',
				policyVersion: '1.0'
			}
		});

		const status = document.querySelector('output')!;
		expect(status.textContent).toContain('recorded');
	});

	it('aborts submission if CSRF token is mismatched (Devil Condition 2)', async () => {
		bindDataRightsForm({
			readStorage: mockReadStorage,
			writeStorage: mockWriteStorage,
			callGdprRpc: mockCallGdprRpc,
			csrfStorageKey: 'CSRF_KEY',
			policyVersion: '1.0'
		});

		const form = document.querySelector('form')!;
		const csrfInput = form.querySelector('[name="csrf"]') as HTMLInputElement;
		// Tamper with the token
		csrfInput.value = 'hacker-token';

		form.dispatchEvent(new Event('submit', { cancelable: true }));
		await new Promise(resolve => setTimeout(resolve, 10));

		// MUST NOT call RPC
		expect(mockCallGdprRpc).not.toHaveBeenCalled();

		const status = document.querySelector('output')!;
		expect(status.textContent).toContain('mismatch');
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
});
