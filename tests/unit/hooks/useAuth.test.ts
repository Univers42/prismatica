import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../../src/hooks/useAuth';

function answer(status: number, body: Record<string, unknown>) {
	const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

function sent(fetchMock: ReturnType<typeof answer>) {
	const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
	return { url, body: JSON.parse(String(init.body)) };
}

describe('useAuth account-mail calls (scripts/auth-gateway.mjs routes)', () => {
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
});
