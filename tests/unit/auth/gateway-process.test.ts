// @vitest-environment node
// The real scripts/auth-gateway.mjs as a child process, against an in-process fake Kong (GoTrue
// + PostgREST) and a fake SMTP listener: proves the glue the module tests cannot see.
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signLink } from '../../../scripts/auth/link-signing.mjs';

const ROOT = resolve(__dirname, '../../..');
const KEY = 'gateway-process-test-key-0123456789abcdef';
const HASH = 'e'.repeat(56);

type Hit = { method: string; path: string; body: string };
const hits: Hit[] = [];
const mails: string[] = [];
let gateway: ChildProcess;
let base = '';
let output = '';
const servers: { close: () => void }[] = [];

function listen(server: net.Server): Promise<number> {
	return new Promise((done) => server.listen(0, '127.0.0.1', () => done((server.address() as net.AddressInfo).port)));
}

async function freePort() {
	const probe = net.createServer();
	const port = await listen(probe);
	await new Promise((done) => probe.close(done));
	return port;
}

function fakeKong() {
	return http.createServer((request, response) => {
		let body = '';
		request.on('data', (chunk) => (body += chunk));
		request.on('end', () => {
			const path = request.url ?? '';
			hits.push({ method: request.method ?? '', path, body });
			const send = (status: number, payload: unknown) => {
				response.writeHead(status, { 'content-type': 'application/json' });
				response.end(JSON.stringify(payload));
			};
			if (path.startsWith('/auth/v1/admin/generate_link')) return send(200, { hashed_token: HASH, action_link: 'http://kong/never' });
			if (path.startsWith('/auth/v1/token?grant_type=refresh_token')) return send(200, { access_token: 'at-1', refresh_token: 'rt-2', user: { id: 'u1' } });
			if (path.startsWith('/auth/v1/logout')) return send(204, {});
			if (path.startsWith('/auth/v1/verify')) return send(200, { access_token: 'at-v', user: { id: 'u1' } });
			if (path.startsWith('/rest/v1/users')) return send(200, []);
			return send(200, {});
		});
	});
}

function fakeSmtp() {
	return net.createServer((socket) => {
		let buffer = '';
		let inData = false;
		socket.write('220 fake\r\n');
		socket.on('data', (chunk) => {
			buffer += chunk.toString();
			for (;;) {
				if (inData) {
					const end = buffer.indexOf('\r\n.\r\n');
					if (end < 0) return;
					mails.push(buffer.slice(0, end));
					buffer = buffer.slice(end + 5);
					inData = false;
					socket.write('250 ok\r\n');
					continue;
				}
				const index = buffer.indexOf('\r\n');
				if (index < 0) return;
				const line = buffer.slice(0, index);
				buffer = buffer.slice(index + 2);
				if (line.startsWith('RCPT TO:<burst')) socket.write('550 mailbox refused\r\n');
				else if (line === 'DATA') {
					inData = true;
					socket.write('354 go\r\n');
				} else if (line === 'QUIT') socket.end('221 bye\r\n');
				else socket.write('250 ok\r\n');
			}
		});
	});
}

async function call(path: string, init: RequestInit = {}) {
	const response = await fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
	return { status: response.status, body: await response.json().catch(() => ({})), cookie: response.headers.get('set-cookie') ?? '' };
}

async function until(check: () => boolean, ms = 5000) {
	const deadline = Date.now() + ms;
	while (!check()) {
		if (Date.now() > deadline) throw new Error('timed out');
		await new Promise((done) => setTimeout(done, 20));
	}
}

beforeAll(async () => {
	const kong = fakeKong();
	const smtp = fakeSmtp();
	const kongPort = await listen(kong);
	const smtpPort = await listen(smtp);
	servers.push(kong, smtp);
	const port = await freePort();
	base = `http://127.0.0.1:${port}`;
	gateway = spawn(process.execPath, ['scripts/auth-gateway.mjs'], {
		cwd: ROOT,
		env: {
			PATH: process.env.PATH,
			AUTH_GATEWAY_PORT: String(port),
			PUBLIC_BAAS_URL: `http://127.0.0.1:${kongPort}`,
			PUBLIC_BAAS_ANON_KEY: 'anon',
			SERVICE_ROLE_KEY: 'service',
			PUBLIC_SITE_URL: 'https://localhost:4322',
			AUTH_REQUIRE_EMAIL_VERIFICATION: 'true',
			TURNSTILE_BYPASS_LOCAL: 'true',
			AUTH_LINK_SIGNING_KEY: KEY,
			SMTP_HOST: '127.0.0.1',
			SMTP_PORT: String(smtpPort),
			EMAIL_FROM: 'no-reply@mail.prismatica.test',
			AUTH_EMAIL_DOMAIN_ALLOWLIST: 'arlet.test',
		},
	});
	gateway.stdout?.on('data', (chunk) => (output += chunk));
	gateway.stderr?.on('data', (chunk) => (output += chunk));
	await until(() => output.includes('Auth gateway listening'), 10_000);
}, 20_000);

afterAll(() => {
	gateway?.kill();
	for (const server of servers) server.close();
});

describe('auth-gateway.mjs as a process', () => {
	it('answers GET /api/auth/health and no longer serves /availability', async () => {
		expect((await call('/api/auth/health')).status).toBe(200);
		expect((await call('/api/auth/availability?email=a%40arlet.test')).status).toBe(404);
	});

	it('answers /recover 202 and mails a signed fragment link built from PUBLIC_SITE_URL, with EHLO domain from EMAIL_FROM', async () => {
		const result = await call('/api/auth/recover', { method: 'POST', body: JSON.stringify({ email: 'ines@arlet.test' }), headers: { host: 'evil.example' } });
		expect(result.status).toBe(202);
		await until(() => mails.length > 0);
		const raw = mails.at(-1) ?? '';
		expect(raw).toMatch(/^Message-ID: <[^@]+@mail\.prismatica\.test>$/m);
		const text = Buffer.from(raw.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0].replaceAll(/\s+/g, ''), 'base64').toString('utf8');
		expect(text).toMatch(new RegExp(`https://localhost:4322/auth/reset-password#token_hash=${HASH}&type=recovery&exp=\\d+&sig=[A-Za-z0-9_-]{43}`));
		expect(text).not.toContain('evil.example');
		expect(text).not.toContain('kong/never');
	});

	it('refuses a tampered link with 410 and sends nothing to GoTrue /verify', async () => {
		const before = hits.filter((hit) => hit.path.startsWith('/auth/v1/verify')).length;
		const exp = Math.floor(Date.now() / 1000) + 600;
		const fields = { token_hash: HASH, type: 'signup', exp: String(exp + 1), sig: signLink(KEY, { type: 'signup', tokenHash: HASH, exp }) };
		const result = await call('/api/auth/verify', { method: 'POST', body: JSON.stringify(fields) });
		expect(result).toMatchObject({ status: 410, body: { error: 'link_invalid' } });
		expect(hits.filter((hit) => hit.path.startsWith('/auth/v1/verify')).length).toBe(before);
	});

	it('logs out with the cookie alone: refresh, then /logout?scope=local, and clears the cookie', async () => {
		const result = await call('/api/auth/logout', { method: 'POST', headers: { cookie: 'prismatica_refresh=rt-1' } });
		expect(result.status).toBe(200);
		expect(result.body.revoked).toBe(true);
		expect(result.cookie).toContain('Max-Age=0');
		expect(hits.some((hit) => hit.path === '/auth/v1/logout?scope=local')).toBe(true);
	});

	it('keeps serving after queued work fails (SMTP refused for a burst of /recover)', async () => {
		for (let index = 0; index < 5; index += 1) {
			expect((await call('/api/auth/recover', { method: 'POST', body: JSON.stringify({ email: `burst${index}@arlet.test` }) })).status).toBe(202);
		}
		await until(() => (output.match(/queued "recovery" failed: SMTP command failed with 550/g) ?? []).length === 5);
		expect((await call('/api/auth/health')).status).toBe(200);
		expect(gateway.exitCode).toBeNull();
	});
});
