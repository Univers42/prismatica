// @vitest-environment node
// The real scripts/auth-gateway.mjs as two child processes (AUTH_LOGIN_EMAIL_OTP unset and
// 'true') against one in-process fake Kong: GoTrue + grobase /v1/auth/otp/*. Proves the flag-off
// login is untouched and the flag-on flow end to end.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, cookieNames, hits, hitsTo, loginBody, RIGHT, startFakeKong, startGateway, stopAll, ticketCookie, ticketPair, upstream, type Gateway } from './gateway-harness';

let off: Gateway;
let on: Gateway;

beforeAll(async () => {
	await startFakeKong();
	off = await startGateway({});
	on = await startGateway({ AUTH_LOGIN_EMAIL_OTP: 'true', AUTH_LOGIN_OTP_RESEND_GAP_SEC: '1' });
}, 30_000);

afterAll(stopAll);

describe('AUTH_LOGIN_EMAIL_OTP off (the default)', () => {
	it('answers a correct login exactly as before: 200, the session body, only the refresh cookie, no otp call', async () => {
		const before = hits.filter((hit) => hit.path.startsWith('/v1/auth/otp')).length;
		const result = await call(off, '/api/auth/login', { body: loginBody() });
		expect(result.status).toBe(200);
		expect(result.text).toBe('{"access_token":"at-0","token_type":"bearer","expires_in":3600,"user":{"id":"u1","email":"ok@arlet.test"}}');
		expect(cookieNames(result.cookies)).toEqual(['prismatica_refresh']);
		expect(hits.filter((hit) => hit.path.startsWith('/v1/auth/otp')).length).toBe(before);
	});

	it('returns 404 for /api/auth/mfa/email/verify and /resend when the emailed-code flow is off', async () => {
		for (const route of ['verify', 'resend']) {
			const result = await call(off, `/api/auth/mfa/email/${route}`, { body: { code: RIGHT } });
			expect(result.status).toBe(404);
			expect(result.body.message).toBe('Not found.');
		}
	});
});
