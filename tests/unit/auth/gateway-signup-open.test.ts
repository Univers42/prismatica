// @vitest-environment node
// The real scripts/auth-gateway.mjs with AUTH_SIGNUP_OPEN / AUTH_TURNSTILE_OPTIONAL: what boots,
// what the register limit does, and that the newsletter stays shut.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, hits, KEY, startFakeKong, startGateway, stopAll } from './gateway-harness';

const ROOT = resolve(__dirname, '../../..');
const PUBLIC_OK = {
	PUBLIC_SITE_URL: 'https://prismatica.example',
	SERVICE_ROLE_KEY: 'service',
	AUTH_TRUSTED_PROXY_HOPS: '2',
	TURNSTILE_SECRET_KEY: 'secret',
	AUTH_LINK_SIGNING_KEY: KEY,
	AUTH_SIGNUP_OPEN: 'true',
	AUTH_MAIL_DAILY_CAP: '50',
	AUTH_REGISTER_RATE_LIMIT_PER_HOUR: '10',
};

function boot(env: Record<string, string>) {
	return new Promise<{ code: number | null; output: string }>((done) => {
		let output = '';
		const child = spawn(process.execPath, ['scripts/auth-gateway.mjs'], { cwd: ROOT, env: { PATH: process.env.PATH, AUTH_GATEWAY_PORT: '0', ...env } });
		const finish = (code: number | null) => {
			child.kill();
			done({ code, output });
		};
		const collect = (chunk: Buffer) => {
			output += chunk;
			if (output.includes('Auth gateway listening')) finish(null);
		};
		child.stdout?.on('data', collect);
		child.stderr?.on('data', collect);
		child.on('exit', finish);
	});
}

describe('boot with AUTH_SIGNUP_OPEN=true on a public https origin', () => {
	it('starts with the full valid set and an empty allowlist', async () => {
		const result = await boot(PUBLIC_OK);
		expect(result.output).not.toContain('FATAL');
		expect(result.output).toContain('Auth gateway listening');
	}, 15_000);

	it.each([
		['verification off', { AUTH_REQUIRE_EMAIL_VERIFICATION: 'false' }, 'AUTH_REQUIRE_EMAIL_VERIFICATION'],
		['AUTH_DEMO_INSECURE', { AUTH_DEMO_INSECURE: 'true' }, 'AUTH_DEMO_INSECURE'],
		['an invalid link key', { AUTH_LINK_SIGNING_KEY: 'short' }, 'AUTH_LINK_SIGNING_KEY'],
		['a cap above 50', { AUTH_MAIL_DAILY_CAP: '51' }, 'AUTH_MAIL_DAILY_CAP'],
		['an unset cap', { AUTH_MAIL_DAILY_CAP: '' }, 'AUTH_MAIL_DAILY_CAP'],
		['the register limit off', { AUTH_REGISTER_RATE_LIMIT_PER_HOUR: '0' }, 'AUTH_REGISTER_RATE_LIMIT_PER_HOUR'],
	])('refuses %s', async (_label, override, named) => {
		const result = await boot({ ...PUBLIC_OK, ...override });
		expect(result.code).toBe(1);
		expect(result.output).toContain(named);
	}, 15_000);

	it('boots without a Turnstile secret only with AUTH_TURNSTILE_OPTIONAL=true, never with the local bypass', async () => {
		const noSecret = { ...PUBLIC_OK, TURNSTILE_SECRET_KEY: '' };
		expect((await boot(noSecret)).output).toContain('TURNSTILE_SECRET_KEY');
		expect((await boot({ ...noSecret, AUTH_TURNSTILE_OPTIONAL: 'true' })).output).toContain('Auth gateway listening');
		const bypass = await boot({ ...noSecret, AUTH_TURNSTILE_OPTIONAL: 'true', TURNSTILE_BYPASS_LOCAL: 'true' });
		expect(bypass.code).toBe(1);
		expect(bypass.output).toContain('TURNSTILE_BYPASS_LOCAL');
	}, 15_000);
});

const registration = (email: string, username: string, turnstileToken?: string) => ({
	email,
	password: 'Right-Pass-1!',
	...(turnstileToken === undefined ? {} : { turnstileToken }),
	profile: { username, confirmPassword: 'Right-Pass-1!', emailVerificationConsent: true },
});
const mailsTo = (address: string) => hits.filter((hit) => hit.path === '/email/v1/send' && hit.body.includes(address)).length;
const settle = () => new Promise((done) => setTimeout(done, 400));

let open: Awaited<ReturnType<typeof startGateway>>;
let closed: typeof open;
let optional: typeof open;
let strict: typeof open;

beforeAll(async () => {
	await startFakeKong();
	open = await startGateway({ AUTH_SIGNUP_OPEN: 'true', AUTH_REGISTER_RATE_LIMIT_PER_HOUR: '3', AUTH_EMAIL_DOMAIN_ALLOWLIST: 'arlet.test,evil.test' });
	closed = await startGateway({ AUTH_SIGNUP_ALLOWLIST: 'ines@arlet.test', AUTH_EMAIL_DOMAIN_ALLOWLIST: 'arlet.test,evil.test' });
	const noBypass = { TURNSTILE_BYPASS_LOCAL: 'false', AUTH_EMAIL_DOMAIN_ALLOWLIST: 'arlet.test' };
	optional = await startGateway({ ...noBypass, AUTH_TURNSTILE_OPTIONAL: 'true' });
	strict = await startGateway({ ...noBypass, TURNSTILE_SECRET_KEY: 'secret', AUTH_TURNSTILE_OPTIONAL: 'true' });
}, 40_000);

afterAll(stopAll);

describe('POST /api/auth/register with signup open', () => {
	it('accepts and mails an address off the allowlist; with a non-empty list the same address is mailed nothing', async () => {
		expect((await call(open, '/api/auth/register', { body: registration('stranger@evil.test', 'stranger_o', 'localhost-turnstile-token') })).status).toBe(202);
		expect((await call(closed, '/api/auth/register', { body: registration('other@evil.test', 'other_c', 'localhost-turnstile-token') })).status).toBe(202);
		await settle();
		expect(mailsTo('stranger@evil.test')).toBeGreaterThan(0);
		expect(mailsTo('other@evil.test')).toBe(0);
	});

	it('limits one IPv4 address, and two IPv6 addresses of one /64 share the bucket', async () => {
		const attempt = (ip: string, n: number) => call(open, '/api/auth/register', { ip, body: registration(`u${n}@arlet.test`, `user_${n}`, 'localhost-turnstile-token') });
		const v4 = [];
		for (let n = 0; n < 4; n += 1) v4.push((await attempt('198.51.100.9', n)).status);
		expect(v4).toEqual([202, 202, 202, 429]);
		const v6 = [];
		for (let n = 0; n < 4; n += 1) v6.push((await attempt(`2001:db8:5:6::${n + 1}`, n + 10)).status);
		v6.push((await attempt('2001:db8:5:6:aaaa:bbbb:cccc:dddd', 20)).status);
		expect(v6).toEqual([202, 202, 202, 429, 429]);
		expect((await attempt('2001:db8:5:7::1', 21)).status).toBe(202);
	});
});

describe('POST /api/newsletter/subscribe with signup open and an empty allowlist', () => {
	it('answers like a success and mails no one, where a listed address is mailed', async () => {
		const subscribe = (gateway: typeof open, email: string) => call(gateway, '/api/newsletter/subscribe', { body: { email, turnstileToken: 'localhost-turnstile-token' } });
		expect((await subscribe(closed, 'ines@arlet.test')).status).toBe(200);
		await settle();
		expect(mailsTo('ines@arlet.test')).toBeGreaterThan(0);
		const before = mailsTo('news@arlet.test');
		const result = await subscribe(open, 'news@arlet.test');
		await settle();
		expect(result.status).toBe(200);
		expect(mailsTo('news@arlet.test')).toBe(before);
	});
});

describe('AUTH_TURNSTILE_OPTIONAL', () => {
	const login = (gateway: typeof open, turnstileToken?: string) => call(gateway, '/api/auth/login', { body: { email: 'ok@arlet.test', password: 'Right-Pass-1!', ...(turnstileToken === undefined ? {} : { turnstileToken }) } });

	it('passes with no secret configured', async () => {
		expect((await login(optional)).status).not.toBe(403);
		expect((await login(optional, 'fixed-token')).status).not.toBe(403);
	});

	it('weakens nothing when a real secret is set: a missing token is still 403', async () => {
		expect((await login(strict)).status).toBe(403);
	});
});

describe('GET /api/auth/health', () => {
	it('answers 200 without auth', async () => {
		const result = await call(open, '/api/auth/health', { method: 'GET' });
		expect(result.status).toBe(200);
		expect(result.body).toEqual({ status: 'ok' });
	});
});
