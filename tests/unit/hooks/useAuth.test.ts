import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../../src/hooks/useAuth';

const link = { token_hash: 'pkce_abc', type: 'recovery' as const, exp: '1792100000', sig: 'c2ln' };

function answer(status: number, body: Record<string, unknown>) {
	const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

function sent(fetchMock: ReturnType<typeof answer>) {
	const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
	return { url, body: JSON.parse(String(init.body)) };
}

describe('useAuth account-mail and link calls (scripts/auth-gateway.mjs routes)', () => {
	afterEach(() => vi.unstubAllGlobals());

	const auth = useAuth({ gatewayUrl: '/api/auth', maxRetries: 0 });

	it('asks for a new verification link at /resend-verification', async () => {
		const fetchMock = answer(202, { message: 'If an account can receive mail at that address, a message is on its way.' });
		const result = await auth.resendVerification({ email: 'ines@arlet.example.com', turnstileToken: 't' });
		expect(sent(fetchMock)).toEqual({ url: '/api/auth/resend-verification', body: { email: 'ines@arlet.example.com', turnstileToken: 't' } });
		expect(result).toMatchObject({ ok: true, status: 202 });
	});

	it('refuses an account-mail request without an email or a Turnstile token, before any call', async () => {
		const fetchMock = answer(202, {});
		expect(await auth.resendVerification({ email: 'nope', turnstileToken: 't' })).toMatchObject({ ok: false, status: 422 });
		expect(await auth.recover({ email: 'ines@arlet.example.com', turnstileToken: '' })).toMatchObject({ ok: false, status: 422 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('posts the signed link fields to /verify', async () => {
		const fetchMock = answer(410, { error: 'link_expired', message: 'This link has expired or is not valid. Ask for a new one.' });
		const result = await auth.verifyEmail({ ...link, type: 'signup' });
		expect(sent(fetchMock)).toEqual({ url: '/api/auth/verify', body: { ...link, type: 'signup' } });
		expect(result).toMatchObject({ ok: false, status: 410, code: 'link_expired', message: 'This link has expired or is not valid. Ask for a new one.' });
	});

	it('returns the reset ticket and the reason when the reset needs a second factor', async () => {
		const fetchMock = answer(401, { error: 'mfa_required', message: 'Enter the 6-digit code from your authenticator app.', reset_ticket: 'ticket-1' });
		const result = await auth.resetPassword({ ...link, password: 'Str0ng!pass' });
		expect(sent(fetchMock)).toEqual({ url: '/api/auth/reset-password', body: { ...link, password: 'Str0ng!pass' } });
		expect(result).toMatchObject({ ok: false, status: 401, code: 'mfa_required', resetTicket: 'ticket-1' });
	});

	it('continues a reset with the ticket alone', async () => {
		const fetchMock = answer(200, { message: 'Your password was changed.', signed_out_everywhere: true });
		await auth.resetPassword({ reset_ticket: 'ticket-1', password: 'Str0ng!pass', code: '123456' });
		expect(sent(fetchMock).body).toEqual({ reset_ticket: 'ticket-1', password: 'Str0ng!pass', code: '123456' });
	});

	it('no longer exposes the /availability lookup', () => {
		expect(auth).not.toHaveProperty('availability');
	});
});
