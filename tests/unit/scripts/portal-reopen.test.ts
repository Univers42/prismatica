import { afterEach, describe, expect, it, vi } from 'vitest';
import { closePortal, openPortal } from '../../../src/scripts/portal';

const loginCalls = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/login')).length;

describe('Portal reopened after a close', () => {
	afterEach(() => {
		closePortal();
		document.body.innerHTML = '';
		vi.unstubAllGlobals();
	});

	it('keeps one .portal in the DOM and sends one sign-in per submit (open, close, open)', async () => {
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ mfa_required: 'email_approve', match: 42 }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		openPortal('connect');
		closePortal();
		openPortal('connect');
		expect(document.querySelectorAll('.portal')).toHaveLength(1);
		document.querySelector<HTMLInputElement>('#portal-email')!.value = 'ines@arlet.test';
		document.querySelector<HTMLInputElement>('#portal-password')!.value = 'Abcdefgh12!';
		document.querySelector<HTMLFormElement>('form.portal-login')?.dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.waitFor(() => expect(loginCalls(fetchMock)).toBeGreaterThan(0));
		await new Promise((done) => setTimeout(done, 50));
		expect(loginCalls(fetchMock)).toBe(1);
	});
});
