import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ALLOWED_REQUEST_TYPES, bindDataRightsForm } from '../../../src/lib/gdpr-form';

describe('GDPR Form', () => {
	let mockReadStorage: ReturnType<typeof vi.fn>;
	let mockWriteStorage: ReturnType<typeof vi.fn>;
	let mockCallGdprRpc: ReturnType<typeof vi.fn>;
	const originalCrypto = globalThis.crypto;

	beforeEach(() => {
		document.body.innerHTML = `
			<form data-gdpr-request-form>
				<input type="hidden" data-csrf-token name="csrf" value="">
				<input name="request_type" value="deletion">
				<input name="email" value="test@example.com">
				<input name="message" value="Please delete">
				<output data-gdpr-request-status></output>
				<button type="submit">Submit</button>
			</form>
		`;
		mockReadStorage = vi.fn().mockReturnValue(null);
		mockWriteStorage = vi.fn();
		mockCallGdprRpc = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		Object.defineProperty(globalThis, 'crypto', {
			value: { getRandomValues: vi.fn((array: Uint8Array) => { array.fill(7); return array; }) },
			configurable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
		vi.restoreAllMocks();
	});

	const dependencies = () => ({
		readStorage: mockReadStorage,
		writeStorage: mockWriteStorage,
		callGdprRpc: mockCallGdprRpc,
		csrfStorageKey: 'CSRF_KEY',
		policyVersion: '1.1.0',
	});

	it('submits successfully when the secure CSRF token matches', async () => {
		bindDataRightsForm(dependencies());
		expect(mockWriteStorage).toHaveBeenCalledWith('CSRF_KEY', '07'.repeat(32));
		document.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(mockCallGdprRpc).toHaveBeenCalledWith('gdpr_submit_request', {
			request_type: 'deletion', email: 'test@example.com',
			details: { message: 'Please delete', csrf: '07'.repeat(32), policyVersion: '1.1.0' },
		});
		expect(document.querySelector('output')?.textContent).toContain('recorded');
	});

	it('aborts submission if the CSRF token is mismatched', async () => {
		bindDataRightsForm(dependencies());
		(document.querySelector('[name="csrf"]') as HTMLInputElement).value = 'tampered-token';
		document.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(mockCallGdprRpc).not.toHaveBeenCalled();
		expect(document.querySelector('output')?.textContent).toContain('mismatch');
	});

	it('does not fall back to a predictable token when secure randomness is unavailable', () => {
		Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
		bindDataRightsForm(dependencies());
		expect(mockWriteStorage).not.toHaveBeenCalled();
		expect(mockCallGdprRpc).not.toHaveBeenCalled();
		expect((document.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
		expect(document.querySelector('output')?.textContent).toContain('HTTPS');
	});

	it('rejects malformed email addresses before making the request', async () => {
		bindDataRightsForm(dependencies());
		(document.querySelector('[name="email"]') as HTMLInputElement).value = 'not-an-email';
		document.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(mockCallGdprRpc).not.toHaveBeenCalled();
		expect(document.querySelector('output')?.textContent).toContain('valid email');
	});

	it('rejects unknown request types before making the request', async () => {
		bindDataRightsForm(dependencies());
		(document.querySelector('[name="request_type"]') as HTMLInputElement).value = 'delete-everyone';
		document.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(mockCallGdprRpc).not.toHaveBeenCalled();
		expect(document.querySelector('output')?.textContent).toContain('valid request type');
	});

	it('rejects consent withdrawal, which the request RPC does not accept', async () => {
		bindDataRightsForm(dependencies());
		(document.querySelector('[name="request_type"]') as HTMLInputElement).value = 'withdrawal';
		document.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(mockCallGdprRpc).not.toHaveBeenCalled();
		expect(ALLOWED_REQUEST_TYPES).toEqual(new Set(['access', 'deletion', 'rectification', 'portability', 'restriction', 'objection']));
	});

	it('rejects details longer than 1,000 characters', async () => {
		bindDataRightsForm(dependencies());
		(document.querySelector('[name="message"]') as HTMLInputElement).value = 'x'.repeat(1001);
		document.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(mockCallGdprRpc).not.toHaveBeenCalled();
		expect(document.querySelector('output')?.textContent).toContain('1,000');
	});

	it('explains rate limiting when the request is throttled', async () => {
		mockCallGdprRpc.mockResolvedValue({ ok: false, status: 429 });
		bindDataRightsForm(dependencies());
		document.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.querySelector('output')?.textContent).toContain('Too many requests');
	});

	it('prevents duplicate submissions while a request is pending', async () => {
		let resolveRequest!: (value: { ok: boolean; status: number }) => void;
		mockCallGdprRpc.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
		bindDataRightsForm(dependencies());
		const form = document.querySelector('form')!;
		form.dispatchEvent(new Event('submit', { cancelable: true }));
		form.dispatchEvent(new Event('submit', { cancelable: true }));
		expect(mockCallGdprRpc).toHaveBeenCalledTimes(1);
		resolveRequest({ ok: true, status: 200 });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect((form.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
	});
});
