import { describe, expect, it, vi } from 'vitest';
import { clearTicketCookie, createLoginOtp, isLoginCode, ticketCookie, ticketFrom } from '../../../scripts/auth/login-otp.mjs';
import { fail, memoryStore, ok } from './fakes';

const KEY = 'login-otp-unit-test-key-0123456789abcdef';

function setup(options: { otp?: Record<string, any>; refresh?: any; gap?: number; key?: string } = {}) {
	const store = memoryStore();
	const otp = { request: vi.fn(async () => 'sent'), verify: vi.fn(async () => 'ok'), ...options.otp };
	const sessions = { logout: vi.fn(async () => ({ status: 200 })) };
	const gotrue = { refresh: vi.fn(async () => options.refresh ?? ok({ access_token: 'at-new', refresh_token: 'rt-new', user: { id: 'u1' } })) };
	const audit = vi.fn();
	const flow = createLoginOtp({ store, otp, sessions, gotrue, signingKey: options.key ?? KEY, resendGapSec: options.gap ?? 0, audit });
	const start = async () => {
		const began: any = await flow.begin({ email: 'a@b.test', userId: 'u1', refreshToken: 'rt-secret-0' });
		return began.ticket as string;
	};
	return { flow, store, otp, sessions, gotrue, audit, start };
}

describe('ticket cookie helpers', () => {
	it('scopes the cookie to the mfa path, HttpOnly, Secure, Strict', () => {
		expect(ticketCookie('T')).toBe('prismatica_mfa=T; HttpOnly; SameSite=Strict; Secure; Path=/api/auth/mfa; Max-Age=600');
		expect(clearTicketCookie()).toContain('Max-Age=0');
	});

	it('reads only a 43-character base64url ticket', () => {
		const ticket = 'A'.repeat(43);
		expect(ticketFrom(`x=1; prismatica_mfa=${ticket}`)).toBe(ticket);
		expect(ticketFrom('prismatica_mfa=short')).toBe('');
		expect(ticketFrom(undefined)).toBe('');
	});

	it('accepts exactly six digits', () => {
		expect(['123456', '000000'].every(isLoginCode)).toBe(true);
		expect(['12345', '1234567', '12345a', '', 123456, null].some(isLoginCode)).toBe(false);
	});
});

describe('login otp begin', () => {
	it('stores the record under a hash of the ticket, with the refresh token encrypted and no access token', async () => {
		const { start, store } = setup();
		const ticket = await start();
		expect(ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
		const entries = [...(store as any).map.entries()];
		const dump = JSON.stringify(entries);
		expect(dump).not.toContain(ticket);
		expect(dump).not.toContain('rt-secret-0');
		expect(dump).toContain('a@b.test');
		expect(dump).not.toMatch(/access_token|at-/);
	});

	it('mints a distinct ticket per login', async () => {
		const { start } = setup();
		expect(await start()).not.toBe(await start());
	});

	it.each([['send_failed', 503], ['unavailable', 503], ['rate_limited', 429]])('on %s revokes the session, keeps no ticket and answers %i', async (outcome, status) => {
		const { flow, sessions, audit } = setup({ otp: { request: vi.fn(async () => outcome) } });
		const result: any = await flow.begin({ email: 'a@b.test', userId: 'u1', refreshToken: 'rt-0' });
		expect(result).toMatchObject({ ok: false, status });
		expect(sessions.logout).toHaveBeenCalledWith('rt-0');
		expect(audit).toHaveBeenCalledWith('login_otp_request_failed', { email: 'a@b.test', outcome });
	});

	it('audits the request that succeeded', async () => {
		const { start, audit } = setup();
		await start();
		expect(audit).toHaveBeenCalledWith('login_otp_requested', { email: 'a@b.test' });
	});
});

describe('login otp verify', () => {
	it('releases the refreshed session, deletes the ticket and asks grobase with the ticket email', async () => {
		const { flow, start, otp, gotrue, audit } = setup();
		const ticket = await start();
		const result: any = await flow.verify(ticket, '123456');
		expect(otp.verify).toHaveBeenCalledWith('a@b.test', '123456');
		expect(gotrue.refresh).toHaveBeenCalledWith('rt-secret-0');
		expect(result).toMatchObject({ status: 200, body: { access_token: 'at-new', user: { id: 'u1' } }, refreshToken: 'rt-new', email: 'a@b.test' });
		expect(result.body.refresh_token).toBeUndefined();
		expect(audit).toHaveBeenCalledWith('login_otp_verified', { email: 'a@b.test' });
		expect((await flow.verify(ticket, '123456') as any).status).toBe(401);
	});

	it('answers 401 otp_ticket_invalid for no ticket or an unknown one', async () => {
		const { flow, otp } = setup();
		expect(await flow.verify('', '123456')).toMatchObject({ status: 401, body: { error: 'otp_ticket_invalid' } });
		expect(await flow.verify('B'.repeat(43), '123456')).toMatchObject({ status: 401 });
		expect(otp.verify).not.toHaveBeenCalled();
	});

	it('answers 422 otp_malformed without calling grobase', async () => {
		const { flow, start, otp } = setup();
		const ticket = await start();
		expect(await flow.verify(ticket, '12ab56')).toMatchObject({ status: 422, body: { error: 'otp_malformed' } });
		expect(otp.verify).not.toHaveBeenCalled();
	});

	it('keeps the ticket on invalid up to the 4th wrong code and locks on the 5th', async () => {
		const { flow, start, sessions, audit } = setup({ otp: { verify: vi.fn(async () => 'invalid') } });
		const ticket = await start();
		for (let count = 0; count < 4; count += 1) expect(await flow.verify(ticket, '000000')).toMatchObject({ status: 401, body: { error: 'otp_invalid' } });
		expect(audit).toHaveBeenCalledWith('login_otp_failed', { email: 'a@b.test' });
		expect(sessions.logout).not.toHaveBeenCalled();
		expect(await flow.verify(ticket, '000000')).toMatchObject({ status: 429, body: { error: 'otp_locked' }, clearTicket: true });
		expect(sessions.logout).toHaveBeenCalledWith('rt-secret-0');
		expect(audit).toHaveBeenCalledWith('login_otp_locked', { email: 'a@b.test' });
		expect(await flow.verify(ticket, '000000')).toMatchObject({ status: 401, body: { error: 'otp_ticket_invalid' } });
	});

	it.each([['expired', 410, 'otp_expired', 'login_otp_expired'], ['locked', 429, 'otp_locked', 'login_otp_locked'], ['mismatch', 429, 'otp_locked', 'login_otp_locked']])('on %s revokes the session and deletes the ticket', async (outcome, status, error, event) => {
		const { flow, start, sessions, audit } = setup({ otp: { verify: vi.fn(async () => outcome) } });
		const ticket = await start();
		expect(await flow.verify(ticket, '123456')).toMatchObject({ status, body: { error }, clearTicket: true });
		expect(sessions.logout).toHaveBeenCalledWith('rt-secret-0');
		expect(audit).toHaveBeenCalledWith(event, { email: 'a@b.test' });
		expect(await flow.verify(ticket, '123456')).toMatchObject({ status: 401 });
	});

	it('keeps the ticket and revokes nothing when grobase is unreachable', async () => {
		const { flow, start, sessions } = setup({ otp: { verify: vi.fn(async () => 'unavailable') } });
		const ticket = await start();
		expect(await flow.verify(ticket, '123456')).toMatchObject({ status: 503, body: { error: 'otp_unavailable' } });
		expect(sessions.logout).not.toHaveBeenCalled();
	});

	it('answers 401 otp_session_lost when GoTrue refuses the stored refresh token', async () => {
		const { flow, start } = setup({ refresh: fail(401) });
		expect(await flow.verify(await start(), '123456')).toMatchObject({ status: 401, body: { error: 'otp_session_lost' }, clearTicket: true });
	});

	it('refuses a record whose ciphertext was moved to another ticket (the ticket hash is the AAD)', async () => {
		const { flow, start, store, gotrue } = setup();
		const first = await start();
		const second = await start();
		const entries = [...(store as any).map.entries()] as [string, { value: string }][];
		const [firstRecord, secondRecord] = entries.map(([, entry]) => JSON.parse(entry.value));
		entries[0][1].value = JSON.stringify({ ...firstRecord, rt: secondRecord.rt });
		expect(await flow.verify(first, '123456')).toMatchObject({ status: 401, body: { error: 'otp_session_lost' } });
		expect(gotrue.refresh).not.toHaveBeenCalled();
		expect(await flow.verify(second, '123456')).toMatchObject({ status: 200 });
	});
});

describe('login otp resend', () => {
	it('answers 401 without a ticket', async () => {
		expect(await setup().flow.resend('')).toMatchObject({ status: 401 });
	});

	it('sends a code up to 3 times, then 429 otp_resend_limit', async () => {
		const { flow, start, otp } = setup();
		const ticket = await start();
		for (let count = 0; count < 3; count += 1) expect(await flow.resend(ticket)).toMatchObject({ status: 200, body: { sent: true } });
		expect(await flow.resend(ticket)).toMatchObject({ status: 429, body: { error: 'otp_resend_limit' } });
		expect(otp.request).toHaveBeenCalledTimes(4);
	});

	it('answers 429 inside the gap, counting the first send as the start of the gap', async () => {
		const { flow, start, otp } = setup({ gap: 30 });
		const ticket = await start();
		expect(await flow.resend(ticket)).toMatchObject({ status: 429, body: { error: 'otp_resend_wait' }, retryAfterSec: 30 });
		expect(otp.request).toHaveBeenCalledTimes(1);
	});

	it.each([['send_failed', 503], ['rate_limited', 429]])('maps a %s answer to %i and audits it', async (outcome, status) => {
		const { flow, start, otp, audit } = setup();
		const ticket = await start();
		otp.request.mockResolvedValueOnce(outcome);
		expect(await flow.resend(ticket)).toMatchObject({ status });
		expect(audit).toHaveBeenCalledWith('login_otp_request_failed', { email: 'a@b.test', outcome });
	});
});

describe('login otp key', () => {
	it('is not ready without a signing key', () => {
		expect(setup({ key: '' }).flow.ready).toBe(false);
		expect(setup().flow.ready).toBe(true);
	});
});
