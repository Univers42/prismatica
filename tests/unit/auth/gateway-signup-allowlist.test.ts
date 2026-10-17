// @vitest-environment node
// The real scripts/auth-gateway.mjs against a fake Kong: a signup or a newsletter request from
// an address off AUTH_SIGNUP_ALLOWLIST must look like a success and send no mail (SGN-2, SGN-3).
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');
const KEY = 'gateway-signup-test-key-0123456789abcdef';
const HASH = 'd'.repeat(56);
const ALLOWED = 'ines@arlet.test';

type Mail = { to: string; subject: string };
type Rpc = { name: string; body: Record<string, any> };
const mails: Mail[] = [];
const rpcs: Rpc[] = [];
const userWrites: string[] = [];
const children: ChildProcess[] = [];
const servers: http.Server[] = [];

function listen(server: net.Server): Promise<number> {
	return new Promise((done) => server.listen(0, '127.0.0.1', () => done((server.address() as net.AddressInfo).port)));
}

function fakeKong() {
	return http.createServer((request, response) => {
		let body = '';
		request.on('data', (chunk) => (body += chunk));
		request.on('end', () => {
			const path = request.url ?? '';
			const send = (status: number, payload: unknown) => {
				response.writeHead(status, { 'content-type': 'application/json' });
				response.end(JSON.stringify(payload));
			};
			if (path === '/email/v1/send') {
				mails.push(JSON.parse(body));
				return send(200, { messageId: 'm1' });
			}
			if (path.startsWith('/rest/v1/rpc/')) rpcs.push({ name: path.slice('/rest/v1/rpc/'.length), body: JSON.parse(body || '{}') });
			if (path.startsWith('/auth/v1/admin/generate_link')) return send(200, { hashed_token: HASH });
			if (path.startsWith('/rest/v1/users')) {
				if (request.method === 'POST') userWrites.push(body);
				return send(200, []);
			}
			return send(200, {});
		});
	});
}

async function startGateway(env: Record<string, string>) {
	const kongPort = await listen(fakeKong().on('listening', function (this: http.Server) { servers.push(this); }));
	const probe = net.createServer();
	const port = await listen(probe);
	await new Promise((done) => probe.close(done));
	let output = '';
	const child = spawn(process.execPath, ['scripts/auth-gateway.mjs'], {
		cwd: ROOT,
		env: {
			PATH: process.env.PATH,
			AUTH_GATEWAY_PORT: String(port),
			PUBLIC_BAAS_URL: `http://127.0.0.1:${kongPort}`,
			PUBLIC_BAAS_ANON_KEY: 'anon',
			SERVICE_ROLE_KEY: 'service',
			PUBLIC_SITE_URL: 'https://localhost:4322',
			AUTH_REQUIRE_EMAIL_VERIFICATION: 'true',
			AUTH_LINK_SIGNING_KEY: KEY,
			AUTH_EMAIL_DOMAIN_ALLOWLIST: 'arlet.test,corp.example,evil.test',
			...env,
		},
	});
	children.push(child);
	child.stdout?.on('data', (chunk) => (output += chunk));
	child.stderr?.on('data', (chunk) => (output += chunk));
	const deadline = Date.now() + 10_000;
	while (!output.includes('Auth gateway listening')) {
		if (Date.now() > deadline) throw new Error(`gateway did not start: ${output}`);
		await new Promise((done) => setTimeout(done, 20));
	}
	return `http://127.0.0.1:${port}`;
}

async function post(base: string, path: string, payload: unknown) {
	const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
	return { status: response.status, body: await response.json().catch(() => ({})) };
}

const registration = (email: string, username: string) => ({
	email,
	password: 'Right-Pass-1!',
	turnstileToken: 'localhost-turnstile-token',
	profile: { username, confirmPassword: 'Right-Pass-1!', emailVerificationConsent: true },
});

async function settle() {
	await new Promise((done) => setTimeout(done, 400));
}

let listed = '';
let unlisted = '';
let strict = '';
let open = '';

beforeAll(async () => {
	const bypass = { TURNSTILE_BYPASS_LOCAL: 'true' };
	listed = await startGateway({ ...bypass, AUTH_SIGNUP_ALLOWLIST: `${ALLOWED}, @corp.example` });
	unlisted = await startGateway({ ...bypass });
	strict = await startGateway({ TURNSTILE_BYPASS_LOCAL: 'false', TURNSTILE_SECRET_KEY: 'secret', AUTH_SIGNUP_ALLOWLIST: ALLOWED });
	open = unlisted;
}, 40_000);

afterAll(() => {
	for (const child of children) child.kill();
	for (const server of servers) server.close();
});

describe('POST /api/auth/register with AUTH_SIGNUP_ALLOWLIST', () => {
	it('answers a refused address exactly like an allowed one and sends nothing for it', async () => {
		const allowed = await post(listed, '/api/auth/register', registration(ALLOWED, 'ines_a'));
		await settle();
		expect(mails.map((mail) => mail.to)).toEqual([ALLOWED]);
		const writesAfterAllowed = userWrites.length;
		const refused = await post(listed, '/api/auth/register', registration('stranger@evil.test', 'stranger_a'));
		await settle();
		expect(refused).toEqual(allowed);
		expect(allowed.status).toBe(202);
		expect(mails.map((mail) => mail.to)).toEqual([ALLOWED]);
		expect(userWrites).toHaveLength(writesAfterAllowed);
		expect(rpcs.find((rpc) => rpc.name === 'auth_record_audit_event' && rpc.body.event_type === 'signup_refused_allowlist')?.body).toMatchObject({ email: 'stranger@evil.test' });
	});

	it('admits any address of a listed domain', async () => {
		const before = mails.length;
		expect((await post(listed, '/api/auth/register', registration('anyone@corp.example', 'anyone_c'))).status).toBe(202);
		await settle();
		expect(mails.slice(before).map((mail) => mail.to)).toEqual(['anyone@corp.example']);
	});

	it('lets everyone in when the list is empty on a local origin', async () => {
		const before = mails.length;
		expect((await post(open, '/api/auth/register', registration('stranger@evil.test', 'stranger_o'))).status).toBe(202);
		await settle();
		expect(mails.slice(before).map((mail) => mail.to)).toEqual(['stranger@evil.test']);
	});

	it('does not gate /recover (SGN-4): an address off the list is still mailed', async () => {
		const before = mails.length;
		expect((await post(listed, '/api/auth/recover', { email: 'stranger@evil.test', turnstileToken: 'localhost-turnstile-token' })).status).toBe(202);
		await settle();
		expect(mails.slice(before).map((mail) => mail.to)).toEqual(['stranger@evil.test']);
		expect(rpcs.some((rpc) => rpc.body.event_type === 'signup_refused_allowlist' && rpc.body.details?.source === 'recover')).toBe(false);
	});
});

describe('POST /api/newsletter/subscribe', () => {
	const subscribe = (base: string, email: string, turnstileToken?: string) => post(base, '/api/newsletter/subscribe', { email, ...(turnstileToken === undefined ? {} : { turnstileToken }) });

	it('answers a refused address exactly like an allowed one and mails only the allowed one', async () => {
		const before = mails.length;
		const allowed = await subscribe(listed, ALLOWED, 'localhost-turnstile-token');
		const refused = await subscribe(listed, 'stranger@evil.test', 'localhost-turnstile-token');
		await settle();
		expect(allowed.status).toBe(200);
		expect({ ...refused, body: refused.body.message.replace('stranger@evil.test', 'X') }).toEqual({ ...allowed, body: allowed.body.message.replace(ALLOWED, 'X') });
		expect(mails.slice(before).map((mail) => mail.to)).toEqual([ALLOWED]);
		expect(rpcs.some((rpc) => rpc.name === 'gdpr_request_newsletter_optin' && rpc.body.email === 'stranger@evil.test')).toBe(false);
		expect(rpcs.some((rpc) => rpc.body.event_type === 'signup_refused_allowlist' && rpc.body.details?.source === 'newsletter')).toBe(true);
	});

	it('answers 403 without a Turnstile token, as /register does, before looking at the list', async () => {
		const before = mails.length;
		const newsletter = await subscribe(strict, ALLOWED);
		const register = await post(strict, '/api/auth/register', { ...registration(ALLOWED, 'ines_s'), turnstileToken: undefined });
		expect(newsletter.status).toBe(403);
		expect(register.status).toBe(403);
		expect(newsletter.body).toEqual(register.body);
		expect((await subscribe(strict, 'stranger@evil.test')).status).toBe(403);
		await settle();
		expect(mails.length).toBe(before);
	});
});

describe('boot on a public https origin', () => {
	function boot(env: Record<string, string>) {
		return new Promise<{ code: number | null; output: string }>((done) => {
			let output = '';
			const child = spawn(process.execPath, ['scripts/auth-gateway.mjs'], {
				cwd: ROOT,
				env: { PATH: process.env.PATH, AUTH_GATEWAY_PORT: '0', SERVICE_ROLE_KEY: 'service', PUBLIC_SITE_URL: 'https://prismatica.example', AUTH_TRUSTED_PROXY_HOPS: '2', TURNSTILE_SECRET_KEY: 'secret', AUTH_LINK_SIGNING_KEY: KEY, ...env },
			});
			children.push(child);
			child.stdout?.on('data', (chunk) => (output += chunk));
			child.stderr?.on('data', (chunk) => (output += chunk));
			child.on('exit', (code) => done({ code, output }));
			setTimeout(() => child.kill(), 4_000);
		});
	}

	it('refuses to start with an empty AUTH_SIGNUP_ALLOWLIST', async () => {
		const result = await boot({});
		expect(result.code).toBe(1);
		expect(result.output).toContain('AUTH_SIGNUP_ALLOWLIST');
	});

	it('does not name the allowlist as a violation once it is set', async () => {
		const result = await boot({ AUTH_SIGNUP_ALLOWLIST: '@prismatica.example' });
		expect(result.output).not.toContain('AUTH_SIGNUP_ALLOWLIST');
	});
});
