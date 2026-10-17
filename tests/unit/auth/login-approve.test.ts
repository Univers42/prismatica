// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLoginApprove, createSignInMailCap, MAIL_CAPS } from '../../../scripts/auth/login-approve.mjs';
import { createLoginOtp, TICKET_TTL_SEC } from '../../../scripts/auth/login-otp.mjs';
import { memoryStore, ok } from './fakes';

const KEY = 'login-approve-unit-test-key-0123456789abcdef';
const EMAIL = 'a@b.test';
const SUMMARY = { occurredAt: 'Saturday, 17 October 2026 (UTC)', ipAddress: '203.0.113.7', location: 'Unknown location', userAgent: 'Firefox/131.0 Linux' };

function setup(options: { refreshDelayMs?: number; sendFails?: boolean } = {}) {
	const store = memoryStore();
	const otp = { request: vi.fn(async () => 'sent'), verify: vi.fn(async () => 'ok') };
	const sessions = { logout: vi.fn(async () => ({ status: 200 })) };
	const gotrue = {
		refresh: vi.fn(async () => {
			if (options.refreshDelayMs) await new Promise((done) => setTimeout(done, options.refreshDelayMs));
			return ok({ access_token: 'at-new', refresh_token: 'rt-new', user: { id: 'u1' } });
		}),
	};
	const audit = vi.fn();
	const mailCap = createSignInMailCap({ store });
	const login = createLoginOtp({ store, otp, sessions, gotrue, signingKey: KEY, resendGapSec: 0, audit, mailCap });
	const sent: { to: string; subject: string; html: string; text: string }[] = [];
	const mail = {
		send: vi.fn(async (message: any) => {
			if (options.sendFails) throw new Error('email service answered HTTP 502');
			sent.push(message);
		}),
		render: vi.fn((_name: string, vars: Record<string, string>) => ({ subject: 'Sign-in request', html: `<a href="${vars.approveUrl}">go</a>`, text: vars.approveUrl })),
	};
	const lockLogin = vi.fn(async () => undefined);
	const approve = createLoginApprove({ otp: login, store, sessions, mail, siteUrl: 'https://site.test', mailCap, lockLogin, audit });

	async function signIn(email = EMAIL) {
		const began: any = await approve.begin({ email, userId: 'u1', refreshToken: 'rt-secret-0', summary: SUMMARY, ip: '203.0.113.7' });
		const token = sent.at(-1)?.text.split('#t=')[1] ?? '';
		return { began, token, ticket: began.ticket as string };
	}
	return { approve, login, store, otp, sessions, gotrue, audit, mail, sent, lockLogin, signIn };
}

afterEach(() => vi.useRealTimers());

describe('begin', () => {
	it('sends exactly one mail, no grobase code, and keeps the ticket id and the number out of it (APR-1, APR-2, APR-3)', async () => {
		const { signIn, sent, otp, store } = setup();
		const { began, token, ticket } = await signIn();
		expect(began.ok).toBe(true);
		expect(began.match).toBeGreaterThanOrEqual(10);
		expect(began.match).toBeLessThan(100);
		expect(sent).toHaveLength(1);
		expect(otp.request).not.toHaveBeenCalled();
		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		const mailed = JSON.stringify(sent);
		const ticketHash = createHash('sha256').update(ticket).digest('hex');
		for (const secret of [ticket, ticketHash]) expect(mailed).not.toContain(secret);
		expect(sent[0].text).toBe(`https://site.test/auth/approve#t=${token}`);
		const keys = [...(store as any).map.keys()] as string[];
		expect(keys).toContain(`otp:approve:${createHash('sha256').update(token).digest('hex')}`);
		expect(JSON.stringify(keys)).not.toContain(token);
	});

	it('answers 503 and logs the parked session out when the mail cannot be sent', async () => {
		const { approve, sessions, store } = setup({ sendFails: true });
		const result: any = await approve.begin({ email: EMAIL, userId: 'u1', refreshToken: 'rt-0', summary: SUMMARY, ip: '1.1.1.1' });
		expect(result).toMatchObject({ ok: false, status: 503 });
		expect(sessions.logout).toHaveBeenCalledTimes(1);
		expect([...(store as any).map.keys()].filter((key: string) => key.startsWith('otp:ticket:') || key.startsWith('otp:approve:'))).toEqual([]);
	});
});

describe('summary (APR-4)', () => {
	it('shows the request and the time left, never the number, and changes nothing', async () => {
		const { approve, signIn, store } = setup();
		const { token } = await signIn();
		const before = JSON.stringify([...(store as any).map.entries()]);
		const result: any = await approve.summary(token);
		expect(result.status).toBe(200);
		expect(result.body.summary).toEqual(SUMMARY);
		expect(result.body.expiresInSec).toBeGreaterThan(590);
		expect(JSON.stringify(result.body)).not.toMatch(/match/);
		expect(JSON.stringify([...(store as any).map.entries()])).toBe(before);
	});

	it('answers 422 for a malformed token and 410 for an unknown one', async () => {
		const { approve } = setup();
		expect((await approve.summary('short')).status).toBe(422);
		expect((await approve.summary(42 as any)).status).toBe(422);
		expect((await approve.summary('A'.repeat(43))).status).toBe(410);
	});
});

describe('approve (APR-5)', () => {
	it('a scanner that only reads the summary approves nothing: the poll stays pending', async () => {
		const { approve, signIn } = setup();
		const { token, ticket } = await signIn();
		for (let index = 0; index < 3; index += 1) await approve.summary(token);
		expect(await approve.status(ticket, '1.1.1.1')).toMatchObject({ status: 202, body: { pending: true } });
	});

	it.each([[{ match: '4' }], [{ match: '123' }], [{ match: 'ab' }], [{ match: 42 }], [{ match: '' }], [{}]])('refuses %j with 422 and changes nothing', async (body: any) => {
		const { approve, signIn, sessions } = setup();
		const { token, ticket, began } = await signIn();
		expect((await approve.approve({ token, match: body.match, ip: 'x' })).status).toBe(422);
		expect((await approve.approve({ token: 'bad', match: String(began.match), ip: 'x' })).status).toBe(422);
		expect(sessions.logout).not.toHaveBeenCalled();
		expect((await approve.status(ticket, 'x')).status).toBe(202);
		expect((await approve.approve({ token, match: String(began.match), ip: 'x' })).status).toBe(200);
	});

	it('the right number approves and answers {approved:true} only: no cookie, no token, no session (APR-9)', async () => {
		const { approve, signIn, gotrue } = setup();
		const { token, began } = await signIn();
		const result: any = await approve.approve({ token, match: String(began.match), ip: '9.9.9.9' });
		expect(result).toEqual({ status: 200, body: { approved: true } });
		expect(gotrue.refresh).not.toHaveBeenCalled();
	});

	it('a wrong number revokes the session at once and the ticket is gone', async () => {
		const { approve, signIn, sessions, audit } = setup();
		const { token, ticket, began } = await signIn();
		const wrong = String(began.match === 99 ? 10 : began.match + 1);
		const result: any = await approve.approve({ token, match: wrong, ip: '9.9.9.9' });
		expect(result).toMatchObject({ status: 409, body: { error: 'approve_mismatch' } });
		expect(sessions.logout).toHaveBeenCalledTimes(1);
		expect(audit).toHaveBeenCalledWith('login_approve_mismatch', { email: EMAIL, ip: '9.9.9.9' });
		expect((await approve.status(ticket, 'x')).status).toBe(410);
		expect((await approve.approve({ token, match: String(began.match), ip: 'x' })).status).toBe(410);
	});

	it('a replayed token answers 410 and does not approve twice', async () => {
		const { approve, signIn, audit } = setup();
		const { token, began } = await signIn();
		expect((await approve.approve({ token, match: String(began.match), ip: 'x' })).status).toBe(200);
		expect((await approve.approve({ token, match: String(began.match), ip: 'x' })).status).toBe(410);
		expect((await approve.deny({ token, ip: 'x' })).status).toBe(410);
		expect(audit.mock.calls.filter(([name]) => name === 'login_approve_approved')).toHaveLength(1);
	});

	it('two concurrent approvals of one token: exactly one acts', async () => {
		const { approve, signIn } = setup();
		const { token, began } = await signIn();
		const results = await Promise.all([approve.approve({ token, match: String(began.match), ip: 'x' }), approve.approve({ token, match: String(began.match), ip: 'x' })]);
		expect(results.map((result: any) => result.status).sort()).toEqual([200, 410]);
	});

	it('an expired ticket answers 410 for the summary, the approval, the denial and the poll', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const { approve, signIn, sessions } = setup();
		const { token, ticket, began } = await signIn();
		vi.setSystemTime(Date.now() + (TICKET_TTL_SEC + 1) * 1000);
		expect((await approve.summary(token)).status).toBe(410);
		expect((await approve.approve({ token, match: String(began.match), ip: 'x' })).status).toBe(410);
		expect((await approve.deny({ token, ip: 'x' })).status).toBe(410);
		expect((await approve.status(ticket, 'x')).status).toBe(410);
		expect(sessions.logout).not.toHaveBeenCalled();
	});
});

describe('deny (APR-6)', () => {
	it('revokes the session, deletes the ticket and locks the account login', async () => {
		const { approve, signIn, sessions, lockLogin, audit } = setup();
		const { token, ticket } = await signIn();
		expect(await approve.deny({ token, ip: '9.9.9.9' })).toEqual({ status: 200, body: { denied: true } });
		expect(sessions.logout).toHaveBeenCalledTimes(1);
		expect(lockLogin).toHaveBeenCalledWith(EMAIL);
		expect(audit).toHaveBeenCalledWith('login_approve_denied', { email: EMAIL, ip: '9.9.9.9' });
		expect((await approve.status(ticket, 'x')).status).toBe(410);
	});

	it('does not lock anything on a malformed or unknown token', async () => {
		const { approve, lockLogin } = setup();
		await approve.deny({ token: 'bad', ip: 'x' });
		await approve.deny({ token: 'A'.repeat(43), ip: 'x' });
		expect(lockLogin).not.toHaveBeenCalled();
	});
});

describe('status (APR-7)', () => {
	it('needs a ticket, polls at most once per 2 s, and answers 202 while pending', async () => {
		const { approve, signIn } = setup();
		const { ticket } = await signIn();
		expect((await approve.status('', 'x')).status).toBe(401);
		expect(await approve.status(ticket, 'x')).toMatchObject({ status: 202, body: { pending: true } });
		expect(await approve.status(ticket, 'x')).toMatchObject({ status: 429, retryAfterSec: 2 });
	});

	it('after the approval it releases the session exactly like a correct code', async () => {
		const polled = setup();
		const { token, ticket, began } = await polled.signIn();
		await polled.approve.approve({ token, match: String(began.match), ip: 'x' });
		const byPoll: any = await polled.approve.status(ticket, 'x');

		const coded = setup();
		const { ticket: codedTicket } = await coded.signIn();
		const byCode: any = await coded.login.verify(codedTicket, '123456');

		expect(byPoll).toEqual(byCode);
		expect(byPoll).toMatchObject({ status: 200, refreshToken: 'rt-new', clearTicket: true, email: EMAIL });
		expect(polled.audit).toHaveBeenCalledWith('login_approve_released', { email: EMAIL, ip: 'x' });
	});
});

describe('release happens once (APR-8)', () => {
	it('a correct code and an approved poll racing for one ticket yield exactly one 200', async () => {
		const { approve, login, signIn, gotrue } = setup({ refreshDelayMs: 25 });
		const { token, ticket, began } = await signIn();
		await approve.approve({ token, match: String(began.match), ip: 'x' });
		const results: any[] = await Promise.all([login.verify(ticket, '123456'), approve.status(ticket, 'x')]);
		expect(results.map((result) => result.status).sort()).toEqual([200, 401]);
		expect(gotrue.refresh).toHaveBeenCalledTimes(1);
	});

	it('two concurrent polls of an approved ticket yield exactly one 200', async () => {
		const { approve, signIn, gotrue } = setup({ refreshDelayMs: 25 });
		const { token, ticket, began } = await signIn();
		await approve.approve({ token, match: String(began.match), ip: 'x' });
		const results: any[] = await Promise.all([approve.status(ticket, 'x'), approve.status(ticket, 'x')]);
		// the per-ticket poll gap answers one of them 429 before the claim is even needed
		expect(results.filter((result) => result.status === 200)).toHaveLength(1);
		expect(gotrue.refresh).toHaveBeenCalledTimes(1);
	});
});

describe('mail cap (APR-10)', () => {
	it('allows 3 sign-in mails per account per 15 minutes, then 429 with no mail and the session logged out', async () => {
		const { approve, signIn, sent, sessions, audit } = setup();
		for (let index = 0; index < MAIL_CAPS[0].max; index += 1) expect((await signIn()).began.ok).toBe(true);
		const fourth: any = await approve.begin({ email: EMAIL, userId: 'u1', refreshToken: 'rt-4', summary: SUMMARY, ip: '2.2.2.2' });
		expect(fourth).toMatchObject({ ok: false, status: 429 });
		expect(sent).toHaveLength(3);
		expect(sessions.logout).toHaveBeenCalledTimes(1);
		expect(audit).toHaveBeenCalledWith('login_approve_capped', { email: EMAIL, ip: '2.2.2.2', via: 'login' });
		expect((await signIn('other@b.test')).began.ok).toBe(true);
	});

	it('counts a code resend with the approval mails', async () => {
		const { login, signIn, otp } = setup();
		const { ticket } = await signIn();
		expect(await login.resend(ticket)).toMatchObject({ status: 200 });
		expect(await login.resend(ticket)).toMatchObject({ status: 200 });
		expect(await login.resend(ticket)).toMatchObject({ status: 429, body: { error: 'otp_resend_limit' } });
		expect(otp.request).toHaveBeenCalledTimes(2);
	});

	it('allows 6 per hour: the 15-minute budget renewing does not lift the hourly one', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const { store } = setup();
		const allow = createSignInMailCap({ store });
		const outcomes: boolean[] = [];
		for (let burst = 0; burst < 3; burst += 1) {
			for (let index = 0; index < 3; index += 1) outcomes.push(await allow(EMAIL));
			vi.setSystemTime(Date.now() + 901_000);
		}
		expect(outcomes.filter(Boolean)).toHaveLength(MAIL_CAPS[1].max);
	});
});

describe('answers that never carry a session (APR-9)', () => {
	it('summary, approve and deny results hold only a status and a body', async () => {
		const { approve, signIn } = setup();
		const { token, began } = await signIn();
		for (const result of [await approve.summary(token), await approve.approve({ token, match: String(began.match), ip: 'x' }), await approve.deny({ token, ip: 'x' })]) {
			expect(Object.keys(result).sort()).toEqual(['body', 'status']);
		}
	});
});
