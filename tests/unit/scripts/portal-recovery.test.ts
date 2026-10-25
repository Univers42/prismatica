import { afterEach, describe, expect, it, vi } from 'vitest';
import { closePortal, openPortal } from '../../../src/scripts/portal';

const recoverCalls = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/recover'));
const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;

function openRecovery(fetchMock: ReturnType<typeof vi.fn>): void {
	vi.stubGlobal('fetch', fetchMock);
	openPortal('connect');
	$<HTMLButtonElement>('[data-portal-action="forgot-password"]').click();
}

function submitEmail(email: string): void {
	const input = $<HTMLInputElement>('#portal-email');
	input.value = email;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	$<HTMLFormElement>('form.portal-login').dispatchEvent(new Event('submit', { cancelable: true }));
}

describe('Portal "Forgot password?"', () => {
	afterEach(() => {
		closePortal();
		document.body.innerHTML = '';
		vi.unstubAllGlobals();
	});

	it('switches the form to recovery: no password field, a reset title and button', () => {
		openRecovery(vi.fn());
		expect($<HTMLElement>('.portal').dataset.portalMode).toBe('recovery');
		expect($<HTMLElement>('[data-auth-title]').textContent).toBe('Reset your password');
		expect($<HTMLInputElement>('#portal-password').closest<HTMLElement>('.field')!.hidden).toBe(true);
		expect($<HTMLInputElement>('#portal-password').required).toBe(false);
		expect($<HTMLButtonElement>('[data-auth-submit]').textContent).toBe('Send reset link');
	});

	it('posts only the email to /recover and confirms once the gateway accepts it', async () => {
		const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
		openRecovery(fetchMock);
		submitEmail('ines@arlet.test');
		await vi.waitFor(() => expect(recoverCalls(fetchMock)).toHaveLength(1));
		const [, init] = recoverCalls(fetchMock)[0] as [string, RequestInit];
		expect(JSON.parse(String(init.body))).toMatchObject({ email: 'ines@arlet.test' });
		await vi.waitFor(() => expect($('.portal-form-error').textContent).toContain('sent'));
		expect($<HTMLButtonElement>('[data-auth-submit]').textContent).toBe('Send reset link');
	});

	it('shows the gateway error instead of claiming the link was sent', async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: 'Reset e-mails are off.' }), { status: 503 }));
		openRecovery(fetchMock);
		submitEmail('ines@arlet.test');
		await vi.waitFor(() => expect(recoverCalls(fetchMock)).toHaveLength(1));
		await vi.waitFor(() => expect($<HTMLElement>('.portal-form-error').hidden).toBe(false));
		expect($('.portal-form-error').textContent).not.toContain('sent');
	});

	it('returns to sign-in from the mode switch', () => {
		openRecovery(vi.fn());
		$<HTMLButtonElement>('[data-auth-switch="login"]').click();
		expect($<HTMLElement>('.portal').dataset.portalMode).toBeUndefined();
		expect($<HTMLInputElement>('#portal-password').closest<HTMLElement>('.field')!.hidden).toBe(false);
		expect($<HTMLButtonElement>('[data-auth-submit]').textContent).toBe('Sign in');
	});
});
