// The real scripts/auth-gateway.mjs as a child process against one in-process fake Kong
// (GoTrue, grobase /v1/auth/otp/*, /email/v1/send). Shared by the gateway-process login suites.
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
export const KEY = 'gateway-login-otp-test-key-0123456789abcdef';
export const RIGHT = '123456';

export type Hit = { method: string; path: string; body: string; apikey?: string };
export type Gateway = { base: string; logs: () => string };

export const hits: Hit[] = [];
export const upstream = { otpRequestStatus: 200, mailStatus: 200 };
export const servers: { close: () => void }[] = [];
const gateways: ChildProcess[] = [];
let kongPort = 0;

export function listen(server: net.Server): Promise<number> {
	return new Promise((done) => server.listen(0, '127.0.0.1', () => done((server.address() as net.AddressInfo).port)));
}

async function freePort() {
	const probe = net.createServer();
	const port = await listen(probe);
	await new Promise((done) => probe.close(done));
	return port;
}

function proofFor(email: string) {
	return `h.${Buffer.from(JSON.stringify({ otp: email, aud: 'otp-proof' })).toString('base64url')}.s`;
}

function fakeKong() {
	return http.createServer((request, response) => {
		let body = '';
		request.on('data', (chunk) => (body += chunk));
		request.on('end', () => {
			const path = request.url ?? '';
			hits.push({ method: request.method ?? '', path, body, apikey: request.headers.apikey as string | undefined });
			const send = (status: number, payload: unknown) => {
				response.writeHead(status, { 'content-type': 'application/json' });
				response.end(JSON.stringify(payload));
			};
			const parsed = body ? JSON.parse(body) : {};
			if (path.startsWith('/auth/v1/token?grant_type=password')) {
				return send(200, { access_token: 'at-0', refresh_token: 'rt-0', token_type: 'bearer', expires_in: 3600, user: { id: 'u1', email: parsed.email } });
			}
			if (path.startsWith('/auth/v1/token?grant_type=refresh_token')) return send(200, { access_token: 'at-1', refresh_token: 'rt-2', token_type: 'bearer', expires_in: 3600, user: { id: 'u1' } });
			if (path.startsWith('/auth/v1/logout')) return send(204, {});
			if (path === '/v1/auth/otp/request') return send(upstream.otpRequestStatus, upstream.otpRequestStatus === 200 ? { sent: true } : { error: 'x' });
			if (path === '/email/v1/send') return send(upstream.mailStatus, {});
			if (path === '/v1/auth/otp/verify') {
				if (parsed.code === RIGHT) return send(200, { verified: true, proof: proofFor(parsed.email) });
				if (parsed.code === '999999') return send(410, { error: 'expired' });
				if (parsed.code === '888888') return send(429, { error: 'too_many_attempts' });
				return send(401, { error: 'invalid_code' });
			}
			if (path.startsWith('/rest/v1/') || path.startsWith('/auth/v1/')) return send(200, path.startsWith('/rest/v1/') ? [] : {});
			return send(200, {});
		});
	});
}

export async function startFakeKong() {
	const kong = fakeKong();
	kongPort = await listen(kong);
	servers.push(kong);
}

export async function startGateway(extraEnv: Record<string, string>): Promise<Gateway> {
	const port = await freePort();
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
			TURNSTILE_BYPASS_LOCAL: 'true',
			AUTH_LINK_SIGNING_KEY: KEY,
			AUTH_EMAIL_DOMAIN_ALLOWLIST: 'arlet.test',
			AUTH_TRUSTED_PROXY_HOPS: '1',
			...extraEnv,
		},
	});
	gateways.push(child);
	child.stdout?.on('data', (chunk) => (output += chunk));
	child.stderr?.on('data', (chunk) => (output += chunk));
	const deadline = Date.now() + 10_000;
	while (!output.includes('Auth gateway listening')) {
		if (Date.now() > deadline) throw new Error('gateway did not start');
		await new Promise((done) => setTimeout(done, 20));
	}
	return { base: `http://127.0.0.1:${port}`, logs: () => output };
}

export function stopAll() {
	for (const child of gateways) child.kill();
	for (const server of servers) server.close();
}

let ipCounter = 0;
export function nextIp() {
	ipCounter += 1;
	return `10.9.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

export async function call(gateway: Gateway, path: string, init: { body?: unknown; cookie?: string; ip?: string; method?: string; headers?: Record<string, string> } = {}) {
	const method = init.method ?? 'POST';
	const response = await fetch(`${gateway.base}${path}`, {
		method,
		headers: { 'content-type': 'application/json', 'x-forwarded-for': init.ip ?? nextIp(), ...(init.cookie ? { cookie: init.cookie } : {}), ...init.headers },
		...(method === 'GET' ? {} : { body: JSON.stringify(init.body ?? {}) }),
	});
	const text = await response.text();
	return { status: response.status, text, body: text ? JSON.parse(text) : {}, cookies: response.headers.getSetCookie() };
}

export const loginBody = (email = 'ok@arlet.test') => ({ email, password: 'Right-Pass-1!', turnstileToken: 'localhost-turnstile-token' });
export const cookieNames = (cookies: string[]) => cookies.map((cookie) => cookie.split('=')[0]);
export const ticketCookie = (cookies: string[]) => cookies.find((cookie) => cookie.startsWith('prismatica_mfa=')) ?? '';
export const ticketPair = (cookies: string[]) => ticketCookie(cookies).split(';')[0];
export const hitsTo = (path: string) => hits.filter((hit) => hit.path === path || hit.path.startsWith(`${path}?`));
