// @vitest-environment node
// The real scripts/auth-gateway.mjs: POST /api/auth/otp/request and /otp/verify against a fake Kong
// (GoTrue admin list, generate_link, verify, /email/v1/send). Code custody is in otp-signin.test.ts;
// this proves the wiring: Turnstile, per-kind limits, the answer shape, the cookie, the audit trail.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, cookieNames, hits, hitsTo, nextIp, startFakeKong, startGateway, stopAll, upstream, type Gateway } from './gateway-harness';

const CONFIRMED = '2026-10-01T00:00:00Z';
let counter = 0;
// Each test gets its own address: the per-address bucket (3 an hour) would throttle a shared one.
function person(confirmed: string | null = CONFIRMED) {
	counter += 1;
	const email = `user${counter}@arlet.test`;
	upstream.users[email] = confirmed;
	return email;
}
const GOOD = 'localhost-turnstile-token';
let gateway: Gateway;
let strict: Gateway;

beforeAll(async () => {
	await startFakeKong();
	gateway = await startGateway({});
	strict = await startGateway({ TURNSTILE_BYPASS_LOCAL: 'false', TURNSTILE_SECRET_KEY: 'secret' });
}, 30_000);

afterAll(stopAll);

const request = (email: string, ip?: string, target = gateway) => call(target, '/api/auth/otp/request', { body: { email, turnstileToken: GOOD }, ip });
const verify = (email: string, code: string, ip?: string, target = gateway) => call(target, '/api/auth/otp/verify', { body: { email, code, turnstileToken: GOOD }, ip });
const mails = () => hitsTo('/email/v1/send').filter((hit) => JSON.parse(hit.body).subject === 'Your sign-in code');

async function waitFor(condition: () => boolean) {
	const deadline = Date.now() + 5000;
	while (!condition()) {
		if (Date.now() > deadline) throw new Error('timed out');
		await new Promise((done) => setTimeout(done, 20));
	}
}

async function mailedCode(email: string): Promise<string> {
	const before = mails().length;
	expect((await request(email)).status).toBe(202);
	await waitFor(() => mails().length > before);
	const sent = JSON.parse(mails().at(-1)!.body);
	expect(sent.to).toBe(email);
	return /\b(\d{6})\b/.exec(sent.text)![1];
}

describe('sign-in by emailed code', () => {
	it('request -> mail -> verify ends in a session body and the refresh cookie, never the refresh token in the body', async () => {
		const EMAIL = person();
		const code = await mailedCode(EMAIL);
		const result = await verify(EMAIL, code);
		expect(result.status).toBe(200);
		expect(result.body).toEqual({ access_token: 'at-code', token_type: 'bearer', expires_in: 3600, user: { id: 'u1', email: EMAIL } });
		expect(result.text).not.toContain('rt-code');
		expect(cookieNames(result.cookies)).toEqual(['prismatica_refresh']);
		expect(result.cookies[0]).toMatch(/HttpOnly/);
		expect(result.cookies[0]).toContain('rt-code');
		expect(JSON.parse(hitsTo('/auth/v1/admin/generate_link').at(-1)!.body)).toEqual({ type: 'magiclink', email: EMAIL });
	});

	it('answers a known, an unknown and an unconfirmed address with the identical 202 and mails only the known one', async () => {
		const EMAIL = person();
		upstream.users['pending@arlet.test'] = null;
		const before = mails().length;
		const answers = [await request(EMAIL), await request('nobody@arlet.test'), await request('pending@arlet.test')];
		for (const answer of answers) {
			expect(answer.status).toBe(202);
			expect(answer.text).toBe(answers[0].text);
			expect(answer.cookies).toEqual([]);
		}
		await waitFor(() => mails().length > before);
		await new Promise((done) => setTimeout(done, 300));
		expect(mails().slice(before).map((hit) => JSON.parse(hit.body).to)).toEqual([EMAIL]);
	});

	it('answers 202 before the GoTrue lookup finishes', async () => {
		const EMAIL = person();
		upstream.lookupDelayMs = 1500;
		const started = Date.now();
		const answer = await request(EMAIL);
		const took = Date.now() - started;
		const before = mails().length;
		await waitFor(() => mails().length > before);
		upstream.lookupDelayMs = 0;
		expect(answer.status).toBe(202);
		expect(took).toBeLessThan(1000);
	});

	it('a wrong code, an unknown address and a malformed code get the one 401, with no cookie', async () => {
		const EMAIL = person();
		const code = await mailedCode(EMAIL);
		const wrong = code === '000000' ? '000001' : '000000';
		const answers = [await verify(EMAIL, wrong), await verify('nobody@arlet.test', code), await verify(EMAIL, 'abc'), await verify('x', code)];
		for (const answer of answers) {
			expect(answer.status).toBe(401);
			expect(answer.body).toEqual({ error: 'signin_code_invalid', message: 'That code is not right or has expired. Request a new one.' });
			expect(answer.cookies).toEqual([]);
		}
	});

	it('locks the code after 5 wrong guesses even for the right one', async () => {
		const EMAIL = person();
		const code = await mailedCode(EMAIL);
		const wrong = code === '000000' ? '000001' : '000000';
		for (let index = 0; index < 5; index += 1) expect((await verify(EMAIL, wrong)).status).toBe(401);
		expect((await verify(EMAIL, code)).status).toBe(401);
	});

	it('is single use through the gateway too', async () => {
		const EMAIL = person();
		const code = await mailedCode(EMAIL);
		expect((await verify(EMAIL, code)).status).toBe(200);
		expect((await verify(EMAIL, code)).status).toBe(401);
	});

	it('never writes the code to the gateway log', async () => {
		const EMAIL = person();
		const code = await mailedCode(EMAIL);
		await verify(EMAIL, code);
		expect(gateway.logs()).not.toContain(code);
	});
});

describe('Turnstile and limits', () => {
	it.each([
		['request', '/api/auth/otp/request', 'otp_request_turnstile_failed', {}],
		['verify', '/api/auth/otp/verify', 'otp_verify_turnstile_failed', { code: '123456' }],
	])('%s with a bad Turnstile token: 403, no GoTrue call, audited', async (_name, path, event, extra) => {
		const EMAIL = person();
		hits.length = 0;
		const result = await call(strict, path, { body: { email: EMAIL, turnstileToken: '', ...extra } });
		expect(result.status).toBe(403);
		expect(result.body).toEqual({ message: 'Anti-abuse verification failed.' });
		expect(hits.filter((hit) => hit.path.startsWith('/auth/v1/'))).toEqual([]);
		await waitFor(() => hits.some((hit) => hit.body.includes(event)));
	});

	it('limits /otp/request per IP to 12 a minute, on its own bucket', async () => {
		const ip = nextIp();
		const statuses: number[] = [];
		for (let index = 0; index < 13; index += 1) statuses.push((await request(`n${index}@arlet.test`, ip)).status);
		expect(statuses.slice(0, 12).every((status) => status === 202)).toBe(true);
		expect(statuses[12]).toBe(429);
		expect((await call(gateway, '/api/auth/recover', { body: { email: 'last@arlet.test', turnstileToken: GOOD }, ip })).status).toBe(202);
	});

	it('limits /otp/verify per IP to 10 a minute', async () => {
		const EMAIL = person();
		const ip = nextIp();
		const statuses: number[] = [];
		for (let index = 0; index < 11; index += 1) statuses.push((await verify(EMAIL, '123456', ip)).status);
		expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
		expect(statuses[10]).toBe(429);
	});

	it('exhausting /recover for an IP does not stop its first code request', async () => {
		const ip = nextIp();
		for (let index = 0; index < 13; index += 1) await call(gateway, '/api/auth/recover', { body: { email: `r${index}@arlet.test`, turnstileToken: GOOD }, ip });
		expect((await call(gateway, '/api/auth/recover', { body: { email: 'last@arlet.test', turnstileToken: GOOD }, ip })).status).toBe(429);
		expect((await request(person(), ip)).status).toBe(202);
	});
});

describe('recovery answers the same for a known and an unknown address', () => {
	it('gives identical status, body and headers for a recovery request', async () => {
		const EMAIL = person();
		const send = (email: string) => call(gateway, '/api/auth/recover', { body: { email, turnstileToken: GOOD } });
		const [known, unknown] = [await send(EMAIL), await send('nobody@arlet.test')];
		expect(known.status).toBe(202);
		expect(unknown.status).toBe(known.status);
		expect(unknown.text).toBe(known.text);
		expect(unknown.cookies).toEqual(known.cookies);
	});
});
