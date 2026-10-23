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

	it('keeps /api/auth/mfa/email/verify and /resend at the 501 reserved answer', async () => {
		for (const route of ['verify', 'resend']) {
			const result = await call(off, `/api/auth/mfa/email/${route}`, { body: { code: RIGHT } });
			expect(result.status).toBe(501);
			expect(result.body.message).toMatch(/MFA hook reserved/);
		}
	});
});

describe('AUTH_LOGIN_EMAIL_OTP on', () => {
	const verify = (cookie: string, body: unknown = { code: RIGHT }) => call(on, '/api/auth/mfa/email/verify', { body, cookie });
	const resend = (cookie: string, ip?: string) => call(on, '/api/auth/mfa/email/resend', { body: {}, cookie, ip });

	it('happy path: login withholds the session, verify releases it, the ticket is single-use', async () => {
		upstream.otpRequestStatus = 200;
		hits.length = 0;
		const login = await call(on, '/api/auth/login', { body: loginBody() });
		expect(login.status).toBe(200);
		expect(login.body).toEqual({ mfa_required: 'email_otp' });
		expect(cookieNames(login.cookies)).toEqual(['prismatica_mfa']);
		const attributes = ticketCookie(login.cookies);
		expect(attributes).toMatch(/HttpOnly/);
		expect(attributes).toMatch(/Secure/);
		expect(attributes).toMatch(/SameSite=Strict/);
		expect(attributes).toMatch(/Path=\/api\/auth\/mfa(;|$)/);
		expect(hitsTo('/v1/auth/otp/request')).toHaveLength(1);
		expect(hitsTo('/v1/auth/otp/request')[0]).toMatchObject({ apikey: 'service', body: '{"email":"ok@arlet.test"}' });

		const cookie = ticketPair(login.cookies);
		const done = await verify(cookie);
		expect(done.status).toBe(200);
		expect(done.body).toMatchObject({ access_token: 'at-1', user: { id: 'u1' } });
		expect(done.body.refresh_token).toBeUndefined();
		expect(cookieNames(done.cookies).sort()).toEqual(['prismatica_mfa', 'prismatica_refresh']);
		expect(done.cookies.find((c) => c.startsWith('prismatica_mfa='))).toMatch(/Max-Age=0/);
		expect(done.cookies.find((c) => c.startsWith('prismatica_refresh='))).toContain('rt-2');
		expect(hitsTo('/auth/v1/token').some((hit) => hit.body.includes('rt-0'))).toBe(true);
		expect(hitsTo('/auth/v1/logout')).toHaveLength(0);

		expect((await verify(cookie)).status).toBe(401);
	});

	it('asks grobase to verify with the ticket email and ignores an email in the verify body (TM21)', async () => {
		const login = await call(on, '/api/auth/login', { body: loginBody('alice@arlet.test') });
		hits.length = 0;
		const done = await verify(ticketPair(login.cookies), { code: RIGHT, email: 'mallory@arlet.test' });
		expect(done.status).toBe(200);
		const sent = JSON.parse(hitsTo('/v1/auth/otp/verify')[0].body);
		expect(sent).toEqual({ email: 'alice@arlet.test', code: RIGHT });
	});

	it('keeps the ticket out of every body and every log line', async () => {
		const login = await call(on, '/api/auth/login', { body: loginBody() });
		const ticket = decodeURIComponent(ticketPair(login.cookies).split('=')[1]);
		expect(ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
		const wrong = await verify(ticketPair(login.cookies), { code: '000000' });
		const done = await verify(ticketPair(login.cookies));
		await resend(ticketPair(login.cookies));
		for (const text of [login.text, wrong.text, done.text, on.logs()]) expect(text).not.toContain(ticket);
		expect(on.logs()).not.toContain('rt-0');
		expect(on.logs()).not.toContain('rt-2');
	});

	it('refuses a missing or unknown ticket and a malformed code without calling grobase', async () => {
		hits.length = 0;
		expect((await verify('')).status).toBe(401);
		expect((await verify('prismatica_mfa=' + 'A'.repeat(43))).status).toBe(401);
		const login = await call(on, '/api/auth/login', { body: loginBody() });
		for (const code of ['12345', '1234567', 'abcdef', 123456, null]) {
			const result = await verify(ticketPair(login.cookies), { code });
			expect(result).toMatchObject({ status: 422, body: { error: 'otp_malformed' } });
		}
		expect(hitsTo('/v1/auth/otp/verify')).toHaveLength(0);
	});

	it('counts wrong codes: 401 otp_invalid keeps the ticket, the 5th wrong code locks and revokes', async () => {
		const login = await call(on, '/api/auth/login', { body: loginBody() });
		const cookie = ticketPair(login.cookies);
		hits.length = 0;
		for (let attempt = 1; attempt <= 4; attempt += 1) {
			expect(await verify(cookie, { code: '000000' })).toMatchObject({ status: 401, body: { error: 'otp_invalid' } });
		}
		expect(hitsTo('/auth/v1/logout')).toHaveLength(0);
		const locked = await verify(cookie, { code: '000000' });
		expect(locked).toMatchObject({ status: 429, body: { error: 'otp_locked' } });
		expect(hitsTo('/auth/v1/logout')).toHaveLength(1);
		expect((await verify(cookie)).status).toBe(401);
	});

	it('answers 429 otp_locked when grobase hits its own attempt cap, and revokes the session', async () => {
		const cookie = ticketPair((await call(on, '/api/auth/login', { body: loginBody() })).cookies);
		hits.length = 0;
		expect(await verify(cookie, { code: '888888' })).toMatchObject({ status: 429, body: { error: 'otp_locked' } });
		expect(hitsTo('/auth/v1/logout')).toHaveLength(1);
	});

	it('answers 410 otp_expired and revokes the GoTrue session when the code expired', async () => {
		const cookie = ticketPair((await call(on, '/api/auth/login', { body: loginBody() })).cookies);
		hits.length = 0;
		const result = await verify(cookie, { code: '999999' });
		expect(result).toMatchObject({ status: 410, body: { error: 'otp_expired' } });
		expect(result.cookies.find((c) => c.startsWith('prismatica_mfa='))).toMatch(/Max-Age=0/);
		expect(hitsTo('/auth/v1/logout')).toHaveLength(1);
		expect(hitsTo('/auth/v1/token').some((hit) => hit.body.includes('rt-0'))).toBe(true);
		expect((await verify(cookie)).status).toBe(401);
	});

	it('revokes the session and answers 503 when grobase cannot send the code, 429 when it rate-limits', async () => {
		for (const [status, expected] of [[502, 503], [429, 429]] as const) {
			upstream.otpRequestStatus = status;
			hits.length = 0;
			const result = await call(on, '/api/auth/login', { body: loginBody() });
			expect(result.status).toBe(expected);
			expect(result.body.message).toMatch(/code/i);
			expect(result.body.access_token).toBeUndefined();
			expect(ticketCookie(result.cookies)).toBe('');
			expect(result.cookies.some((c) => c.startsWith('prismatica_refresh='))).toBe(false);
			expect(hitsTo('/auth/v1/logout')).toHaveLength(1);
		}
		upstream.otpRequestStatus = 200;
	});

	it('resend: 429 inside the gap, then 3 allowed, then the 4th is 429', async () => {
		const login = await call(on, '/api/auth/login', { body: loginBody() });
		const cookie = ticketPair(login.cookies);
		hits.length = 0;
		const tooSoon = await resend(cookie);
		expect(tooSoon.status).toBe(429);
		expect(Number(tooSoon.cookies.length)).toBe(0);
		expect(hitsTo('/v1/auth/otp/request')).toHaveLength(0);
		for (let index = 0; index < 3; index += 1) {
			await new Promise((done) => setTimeout(done, 1100));
			expect(await resend(cookie)).toMatchObject({ status: 200, body: { sent: true } });
		}
		await new Promise((done) => setTimeout(done, 1100));
		expect(await resend(cookie)).toMatchObject({ status: 429, body: { error: 'otp_resend_limit' } });
		expect(hitsTo('/v1/auth/otp/request')).toHaveLength(3);
	}, 20_000);

	it('resend needs a ticket and is capped per IP at 20 an hour', async () => {
		expect((await resend('')).status).toBe(401);
		const login = await call(on, '/api/auth/login', { body: loginBody() });
		const cookie = ticketPair(login.cookies);
		const ip = '10.77.0.1';
		const statuses: number[] = [];
		for (let index = 0; index < 22; index += 1) statuses.push((await resend(cookie, ip)).status);
		expect(statuses.at(-1)).toBe(429);
		expect(statuses.filter((status) => status === 429).length).toBeGreaterThanOrEqual(2);
	});

	it('keeps the other /api/auth/mfa/* routes at 501', async () => {
		const result = await call(on, '/api/auth/mfa/totp/enroll', { body: {} });
		expect(result.status).toBe(501);
	});
});
