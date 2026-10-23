// @vitest-environment node
// The real gateway as child processes: AUTH_LOGIN_APPROVE_LINK off (with the emailed code on) must
// be byte-identical to today (APR-11); on, the whole "Yes, it's me" flow runs over HTTP.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, cookieNames, hits, hitsTo, loginBody, nextIp, RIGHT, startFakeKong, startGateway, stopAll, ticketCookie, ticketPair, upstream, type Gateway } from './gateway-harness';

let codeOnly: Gateway;
let approveOnly: Gateway;
let on: Gateway;

beforeAll(async () => {
	await startFakeKong();
	codeOnly = await startGateway({ AUTH_LOGIN_EMAIL_OTP: 'true', AUTH_LOGIN_OTP_RESEND_GAP_SEC: '1' });
	approveOnly = await startGateway({ AUTH_LOGIN_APPROVE_LINK: 'true' });
	on = await startGateway({ AUTH_LOGIN_EMAIL_OTP: 'true', AUTH_LOGIN_APPROVE_LINK: 'true', AUTH_LOGIN_OTP_RESEND_GAP_SEC: '0' });
}, 30_000);

afterAll(stopAll);

let emailCounter = 0;
const freshEmail = () => `user${(emailCounter += 1)}@arlet.test`;
const mailTo = (email: string) => hitsTo('/email/v1/send').filter((hit) => JSON.parse(hit.body).to === email);
const tokenFrom = (email: string) => decodeURIComponent(JSON.parse(mailTo(email).at(-1)!.body).text.split('#t=')[1].split(/\s/)[0]);

async function signIn(email = freshEmail(), headers: Record<string, string> = {}) {
	const login = await call(on, '/api/auth/login', { body: loginBody(email), headers });
	return { login, email, cookie: ticketPair(login.cookies), match: String(login.body.match), token: login.status === 200 ? tokenFrom(email) : '' };
}

const approve = (token: string, match: string, extra: { cookie?: string } = {}) => call(on, '/api/auth/mfa/approve', { body: { token, match }, ...extra });
const status = (cookie: string) => call(on, '/api/auth/mfa/email/status', { body: {}, cookie });
const verify = (cookie: string, code = RIGHT) => call(on, '/api/auth/mfa/email/verify', { body: { code }, cookie });

describe('flag off: AUTH_LOGIN_EMAIL_OTP alone is unchanged (APR-11)', () => {
	it('logs in with the emailed code exactly as before: the code mail path, no approval mail, no match', async () => {
		const email = freshEmail();
		hits.length = 0;
		const login = await call(codeOnly, '/api/auth/login', { body: loginBody(email) });
		expect(login.text).toBe('{"mfa_required":"email_otp"}');
		expect(cookieNames(login.cookies)).toEqual(['prismatica_mfa']);
		expect(hitsTo('/v1/auth/otp/request')).toHaveLength(1);
		expect(mailTo(email)).toHaveLength(0);
	});

	it('leaves the approval routes at the 501 reserved answer', async () => {
		for (const route of ['approve', 'approve/summary', 'deny', 'email/status']) {
			const result = await call(codeOnly, `/api/auth/mfa/${route}`, { body: { token: 'A'.repeat(43), match: '42' } });
			expect(result.status, route).toBe(501);
		}
	});

	it('ignores the approve flag without the emailed code', async () => {
		const login = await call(approveOnly, '/api/auth/login', { body: loginBody(freshEmail()) });
		expect(login.body.access_token).toBe('at-0');
		expect(login.body.mfa_required).toBeUndefined();
		expect((await call(approveOnly, '/api/auth/mfa/approve', { body: {} })).status).toBe(501);
	});
});

describe('flag on', () => {
	it('login answers the number and the ticket cookie, sends one mail and asks grobase for no code (APR-1, APR-3)', async () => {
		const email = freshEmail();
		hits.length = 0;
		const { login, match } = await signIn(email, { 'user-agent': 'Mozilla/5.0 <script>alert(1)</script> Firefox/131.0' });
		expect(login.status).toBe(200);
		expect(login.body).toEqual({ mfa_required: 'email_approve', match: Number(match) });
		expect(Number(match)).toBeGreaterThanOrEqual(10);
		expect(cookieNames(login.cookies)).toEqual(['prismatica_mfa']);
		expect(hitsTo('/v1/auth/otp/request')).toHaveLength(0);
		const mails = mailTo(email);
		expect(mails).toHaveLength(1);
		const sent = JSON.parse(mails[0].body);
		expect(sent.subject).toBe('Sign-in request');
		expect(sent.html).toContain('https://localhost:4322/auth/approve#t=');
		expect(sent.html).toMatch(/can see the 2-digit number/);
		expect(sent.html).not.toContain('<script>');
		expect(sent.html).not.toContain(ticketPair(login.cookies).split('=')[1]);
		expect(sent.html + sent.text).not.toContain(`number: ${match}`);
	});

	it('a scanner that only GETs the page or the routes approves nothing; the summary is a POST', async () => {
		const { cookie, token } = await signIn();
		for (const path of ['/api/auth/mfa/approve/summary', '/api/auth/mfa/approve', '/api/auth/mfa/deny']) {
			expect((await call(on, path, { method: 'GET' })).status).toBe(404);
		}
		expect((await call(on, '/api/auth/mfa/approve/summary', { body: { token } })).status).toBe(200);
		expect((await status(cookie)).status).toBe(202);
	});

	it('the right number approves; the approving device gets no Set-Cookie, no token, even when it sends a ticket cookie (APR-9)', async () => {
		const { cookie, token, match } = await signIn();
		const other = await signIn();
		const approved = await approve(token, match, { cookie: other.cookie });
		expect(approved.status).toBe(200);
		expect(approved.text).toBe('{"approved":true}');
		expect(approved.cookies).toEqual([]);
		expect((await status(other.cookie)).status).toBe(202);
		expect((await status(cookie)).status).toBe(200);
	});

	it('the approved poll answers the same body and cookies as a correct code, then the ticket is spent (APR-7)', async () => {
		const polled = await signIn();
		await approve(polled.token, polled.match);
		const byPoll = await status(polled.cookie);
		const coded = await signIn();
		const byCode = await verify(coded.cookie);
		expect(byPoll.status).toBe(200);
		expect(byPoll.text).toBe(byCode.text);
		expect(byPoll.cookies.map((cookie) => cookie.replace(/=[^;]*/, ''))).toEqual(byCode.cookies.map((cookie) => cookie.replace(/=[^;]*/, '')));
		expect(byPoll.cookies.find((cookie) => cookie.startsWith('prismatica_refresh='))).toContain('rt-2');
		expect((await status(polled.cookie)).status).toBe(410);
	});

	it('polls at most once per 2 s per ticket', async () => {
		const { cookie } = await signIn();
		expect((await status(cookie)).status).toBe(202);
		const again = await status(cookie);
		expect(again.status).toBe(429);
	});

	it('a wrong number revokes the GoTrue session at once and the ticket is gone', async () => {
		const { cookie, token, match } = await signIn();
		hits.length = 0;
		const wrong = String(Number(match) === 99 ? 10 : Number(match) + 1);
		const result = await approve(token, wrong);
		expect(result).toMatchObject({ status: 409, body: { error: 'approve_mismatch' } });
		expect(result.cookies).toEqual([]);
		expect(hitsTo('/auth/v1/logout')).toHaveLength(1);
		expect((await status(cookie)).status).toBe(410);
		expect((await approve(token, match)).status).toBe(410);
	});

	it('a replayed token answers 410', async () => {
		const { token, match } = await signIn();
		expect((await approve(token, match)).status).toBe(200);
		expect((await approve(token, match)).status).toBe(410);
		expect((await call(on, '/api/auth/mfa/approve/summary', { body: { token } })).status).toBe(410);
	});

	it('malformed bodies answer 422 and leave the request approvable', async () => {
		const { cookie, token, match } = await signIn();
		for (const body of [{}, { token, match: 'ab' }, { token, match: 42 }, { token: 'x', match }]) {
			expect((await call(on, '/api/auth/mfa/approve', { body })).status).toBe(422);
		}
		expect((await call(on, '/api/auth/mfa/approve/summary', { body: { token: 'x' } })).status).toBe(422);
		expect((await status(cookie)).status).toBe(202);
		expect((await approve(token, match)).status).toBe(200);
	});

	it('deny revokes the session and locks the account: the next login answers 429', async () => {
		const { cookie, token, email } = await signIn();
		hits.length = 0;
		expect(await call(on, '/api/auth/mfa/deny', { body: { token } })).toMatchObject({ status: 200, body: { denied: true } });
		expect(hitsTo('/auth/v1/logout')).toHaveLength(1);
		expect((await status(cookie)).status).toBe(410);
		const again = await call(on, '/api/auth/login', { body: loginBody(email) });
		expect(again.status).toBe(429);
		expect(again.body.access_token).toBeUndefined();
	});

	it('a code and an approved poll racing for one ticket yield exactly one 200 (APR-8)', async () => {
		const { cookie, token, match } = await signIn();
		await approve(token, match);
		const results = await Promise.all([verify(cookie), status(cookie)]);
		expect(results.map((result) => result.status).sort()).toEqual([200, 401]);
		expect(results.filter((result) => result.cookies.some((cookie) => cookie.startsWith('prismatica_refresh='))).length).toBe(1);
	});

	it('"Email me a code instead" keeps working on the same ticket and a correct code releases', async () => {
		const { cookie } = await signIn();
		hits.length = 0;
		expect(await call(on, '/api/auth/mfa/email/resend', { body: {}, cookie })).toMatchObject({ status: 200, body: { sent: true } });
		expect(hitsTo('/v1/auth/otp/request')).toHaveLength(1);
		const done = await verify(cookie);
		expect(done.status).toBe(200);
		expect(done.body.access_token).toBe('at-1');
	});

	it('503 and a revoked session when the mail cannot be sent', async () => {
		upstream.mailStatus = 500;
		try {
			hits.length = 0;
			const login = await call(on, '/api/auth/login', { body: loginBody(freshEmail()) });
			expect(login.status).toBe(503);
			expect(ticketCookie(login.cookies)).toBe('');
			expect(hitsTo('/auth/v1/logout')).toHaveLength(1);
		} finally {
			upstream.mailStatus = 200;
		}
	});

	it('caps sign-in mails at 3 per account per 15 minutes: the 4th login is 429, no mail, session logged out (APR-10)', async () => {
		const email = freshEmail();
		for (let index = 0; index < 3; index += 1) expect((await call(on, '/api/auth/login', { body: loginBody(email), ip: nextIp() })).status).toBe(200);
		hits.length = 0;
		const fourth = await call(on, '/api/auth/login', { body: loginBody(email), ip: nextIp() });
		expect(fourth.status).toBe(429);
		expect(mailTo(email)).toHaveLength(0);
		expect(hitsTo('/auth/v1/logout')).toHaveLength(1);
		expect(ticketCookie(fourth.cookies)).toBe('');
	});

	it('keeps the approval token and the ticket out of the gateway log', async () => {
		const { token, cookie } = await signIn();
		await approve(token, '10');
		expect(on.logs()).not.toContain(token);
		expect(on.logs()).not.toContain(cookie.split('=')[1]);
	});
});
