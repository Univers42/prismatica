import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePortal, openPortal } from '../../../src/scripts/portal';
import { POLL_START_MS, WAIT_LIMIT_MS } from '../../../src/scripts/portal-login-approve';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function gateway(routes: Record<string, () => Response>) {
	const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
		const route = Object.keys(routes).find((suffix) => String(url).endsWith(suffix));
		return route ? routes[route]() : new Response('{}', { status: 200 });
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

const calls = (fetchMock: ReturnType<typeof gateway>, suffix: string) => fetchMock.mock.calls.filter(([url]) => String(url).endsWith(suffix)).length;
const step = () => document.querySelector<HTMLElement>('section.portal-login-approve')!;
const passwordForm = () => document.querySelector<HTMLElement>('form.portal-login')!;

async function signIn() {
	openPortal('connect');
	document.querySelector<HTMLInputElement>('#portal-email')!.value = 'ines@arlet.test';
	document.querySelector<HTMLInputElement>('#portal-password')!.value = 'Abcdefgh12!';
	document.querySelector<HTMLFormElement>('form.portal-login')?.dispatchEvent(new Event('submit', { cancelable: true }));
	await vi.waitFor(() => expect(step().hidden).toBe(false));
}

describe('Portal approval waiting step', () => {
	beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
	afterEach(() => {
		closePortal();
		document.body.innerHTML = '';
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('ships hidden; the answer email_approve swaps the password form for the number and the instruction', async () => {
		openPortal('connect');
		expect(step().hidden).toBe(true);
		closePortal();
		gateway({ '/login': () => json(200, { mfa_required: 'email_approve', match: 42 }) });
		await signIn();
		expect(passwordForm().hidden).toBe(true);
		expect(step().textContent).toMatch(/Open the mail on your phone, tap Approve, type this number:\s*42/);
		expect(step().querySelector('[data-login-approve-code]')?.textContent).toBe('Email me a code instead');
	});

	it('polls the status route while pending, then continues with the session it returns', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		let polls = 0;
		const fetchMock = gateway({
			'/login': () => json(200, { mfa_required: 'email_approve', match: 42 }),
			'/mfa/email/status': () => (++polls < 3 ? json(202, { pending: true }) : json(200, { access_token: 'at-1', expires_in: 3600 })),
			'/osionos-session': () => json(200, { redirectUrl: 'https://evil.example/x' }),
		});
		await signIn();
		expect(calls(fetchMock, '/mfa/email/status')).toBe(0);
		await vi.advanceTimersByTimeAsync(POLL_START_MS);
		expect(calls(fetchMock, '/mfa/email/status')).toBe(1);
		await vi.advanceTimersByTimeAsync(POLL_START_MS * 2);
		expect(calls(fetchMock, '/mfa/email/status')).toBe(2);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(calls(fetchMock, '/osionos-session')).toBe(1);
		const status = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/mfa/email/status'));
		expect((status?.[1] as RequestInit).credentials).toBe('include');
		await vi.advanceTimersByTimeAsync(60_000);
		expect(calls(fetchMock, '/mfa/email/status')).toBe(3);
	});

	it('returns to the password form with the message and stops polling when the request is gone', async () => {
		const fetchMock = gateway({
			'/login': () => json(200, { mfa_required: 'email_approve', match: 42 }),
			'/mfa/email/status': () => json(410, { error: 'approve_gone', message: 'This sign-in request is no longer valid.' }),
		});
		await signIn();
		await vi.advanceTimersByTimeAsync(POLL_START_MS);
		expect(step().hidden).toBe(true);
		expect(passwordForm().hidden).toBe(false);
		expect(document.querySelector('form.portal-login .portal-form-error')?.textContent).toBe('This sign-in request is no longer valid.');
		await vi.advanceTimersByTimeAsync(60_000);
		expect(calls(fetchMock, '/mfa/email/status')).toBe(1);
	});

	it('waits out a 429 instead of leaving', async () => {
		let polls = 0;
		const fetchMock = gateway({
			'/login': () => json(200, { mfa_required: 'email_approve', match: 42 }),
			'/mfa/email/status': () => (++polls === 1 ? json(429, { error: 'poll_too_fast' }) : json(202, { pending: true })),
		});
		await signIn();
		await vi.advanceTimersByTimeAsync(POLL_START_MS * 3);
		expect(step().hidden).toBe(false);
		expect(calls(fetchMock, '/mfa/email/status')).toBeGreaterThanOrEqual(2);
	});

	it('stops at the ticket lifetime and says the request expired', async () => {
		const fetchMock = gateway({
			'/login': () => json(200, { mfa_required: 'email_approve', match: 42 }),
			'/mfa/email/status': () => json(202, { pending: true }),
		});
		await signIn();
		await vi.advanceTimersByTimeAsync(WAIT_LIMIT_MS + 20_000);
		expect(step().hidden).toBe(true);
		expect(document.querySelector('form.portal-login .portal-form-error')?.textContent).toMatch(/expired/);
		const total = calls(fetchMock, '/mfa/email/status');
		await vi.advanceTimersByTimeAsync(60_000);
		expect(calls(fetchMock, '/mfa/email/status')).toBe(total);
	});

	it('"Email me a code instead" asks for the code on the same ticket, shows the code step and stops polling', async () => {
		const fetchMock = gateway({
			'/login': () => json(200, { mfa_required: 'email_approve', match: 42 }),
			'/mfa/email/status': () => json(202, { pending: true }),
			'/mfa/email/resend': () => json(200, { sent: true }),
		});
		await signIn();
		step().querySelector<HTMLButtonElement>('[data-login-approve-code]')?.click();
		await vi.advanceTimersByTimeAsync(0);
		expect(calls(fetchMock, '/mfa/email/resend')).toBe(1);
		expect(document.querySelector<HTMLElement>('form.portal-login-code')?.hidden).toBe(false);
		expect(step().hidden).toBe(true);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(calls(fetchMock, '/mfa/email/status')).toBe(0);
	});

	it('keeps waiting and says why when the code cannot be sent', async () => {
		gateway({
			'/login': () => json(200, { mfa_required: 'email_approve', match: 42 }),
			'/mfa/email/status': () => json(202, { pending: true }),
			'/mfa/email/resend': () => json(429, { error: 'otp_resend_limit', message: 'No more codes can be sent for this sign-in. Sign in again.' }),
		});
		await signIn();
		step().querySelector<HTMLButtonElement>('[data-login-approve-code]')?.click();
		// useAuth retries HTTP 429 with backoff before returning the gateway's error.
		await vi.waitFor(() => expect(step().querySelector('[data-login-approve-error]')?.textContent).toMatch(/No more codes/), { timeout: 5000 });
		expect(step().hidden).toBe(false);
	});

	it('Cancel returns to the password form and stops polling', async () => {
		const fetchMock = gateway({
			'/login': () => json(200, { mfa_required: 'email_approve', match: 42 }),
			'/mfa/email/status': () => json(202, { pending: true }),
		});
		await signIn();
		step().querySelector<HTMLButtonElement>('[data-login-approve-cancel]')?.click();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(passwordForm().hidden).toBe(false);
		expect(calls(fetchMock, '/mfa/email/status')).toBe(0);
	});

	it('closing the portal stops pending approval polling', async () => {
		const fetchMock = gateway({
			'/login': () => json(200, { mfa_required: 'email_approve', match: 42 }),
			'/mfa/email/status': () => json(202, { pending: true }),
		});
		await signIn();
		closePortal();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(document.querySelector('.portal')).toBeNull();
		expect(calls(fetchMock, '/mfa/email/status')).toBe(0);
	});
});
