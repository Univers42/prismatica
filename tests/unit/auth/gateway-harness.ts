// The real scripts/auth-gateway.mjs as a child process against one in-process fake Kong
// (GoTrue, grobase /v1/auth/otp/*, /email/v1/send). Shared by the gateway-process login suites.
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { resolve } from 'node:path';

export const ROOT = resolve(__dirname, '../../..');
export const KEY = 'gateway-login-otp-test-key-0123456789abcdef';
export const RIGHT = '123456';

export type Hit = { method: string; path: string; body: string; apikey?: string };
export type Gateway = { base: string; logs: () => string };

export const hits: Hit[] = [];
export const upstream = {
	otpRequestStatus: 200,
	mailStatus: 200,
	passwordStatus: 200,
	auditDelayMs: 0,
	existingEmails: [] as string[],
	users: {} as Record<string, string | null>,
	magicEmail: '',
	lookupDelayMs: 0,
	// /auth/v1/user: the caller's own lookup, with the fields the collision guard reads.
	userStatus: 200,
	user: {} as Record<string, unknown>,
	amr: [{ method: 'password' }] as { method: string }[],
	// /auth/v1/token?grant_type=pkce: 200 only for this exact pair, 404 flow_state_not_found otherwise.
	pkce: { auth_code: 'code-1', code_verifier: 'verifier-1' },
	pkceTokenStatus: 200,
	pkceError: { error: 'invalid_grant', error_description: 'bad code' } as Record<string, unknown>,
	// /auth/v1/settings: the GoTrue autoconfirm switch (F15).
	settingsStatus: 200,
	settings: { mailer_autoconfirm: false } as Record<string, unknown>,
	logoutStatus: 204,
};
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
			const reply = (status: number, payload: unknown) => {
				response.writeHead(status, { 'content-type': 'application/json' });
				response.end(JSON.stringify(payload));
			};
			// A slow audit write stands in for the database round trip the gateway must not wait on.
			const send = path.includes('auth_record_audit_event') && upstream.auditDelayMs > 0 ? (status: number, payload: unknown) => setTimeout(() => reply(status, payload), upstream.auditDelayMs) : reply;
			const parsed = body ? JSON.parse(body) : {};
			if (path.startsWith('/auth/v1/token?grant_type=password')) {
				if (upstream.passwordStatus !== 200) return send(upstream.passwordStatus, { error: 'invalid_grant' });
				return send(200, { access_token: 'at-0', refresh_token: 'rt-0', token_type: 'bearer', expires_in: 3600, user: { id: 'u1', email: parsed.email } });
			}
			if (path.startsWith('/auth/v1/token?grant_type=refresh_token')) return send(200, { access_token: 'at-1', refresh_token: 'rt-2', token_type: 'bearer', expires_in: 3600, user: { id: 'u1' } });
			if (path.startsWith('/auth/v1/token?grant_type=pkce')) {
				const pair = upstream.pkce;
				const matches = parsed.auth_code === pair.auth_code && parsed.code_verifier === pair.code_verifier;
				if (upstream.pkceTokenStatus !== 200) return send(upstream.pkceTokenStatus, upstream.pkceError);
				if (!matches) return send(404, { error_code: 'flow_state_not_found', msg: 'invalid flow state' });
				return send(200, { access_token: 'oauth-at', refresh_token: 'oauth-rt', token_type: 'bearer', expires_in: 3600, user: { id: 'u1' } });
			}
			if (path.startsWith('/auth/v1/settings')) return send(upstream.settingsStatus, upstream.settings);
			if (path.startsWith('/auth/v1/user')) return send(upstream.userStatus, { ...upstream.user, amr: upstream.amr });
			if (path.startsWith('/auth/v1/logout')) return send(upstream.logoutStatus, {});
			if (path === '/v1/auth/otp/request') return send(upstream.otpRequestStatus, upstream.otpRequestStatus === 200 ? { sent: true } : { error: 'x' });
			if (path === '/email/v1/send') return send(upstream.mailStatus, {});
			if (path === '/v1/auth/otp/verify') {
				if (parsed.code === RIGHT) return send(200, { verified: true, proof: proofFor(parsed.email) });
				if (parsed.code === '999999') return send(410, { error: 'expired' });
				if (parsed.code === '888888') return send(429, { error: 'too_many_attempts' });
				return send(401, { error: 'invalid_code' });
			}
			if (path.startsWith('/auth/v1/admin/generate_link')) {
				if (parsed.type === 'magiclink') upstream.magicEmail = String(parsed.email);
				return send(200, { hashed_token: 'd'.repeat(56) });
			}
			// The admin user list behind the code sign-in; `upstream.users` maps address -> email_confirmed_at.
			if (path.startsWith('/auth/v1/admin/users') && request.method === 'GET') {
				const filter = new URL(path, 'https://x').searchParams.get('filter') ?? '';
				const users = Object.entries(upstream.users).filter(([email]) => email.includes(filter)).map(([email, confirmed]) => ({ id: `id-${email}`, email, email_confirmed_at: confirmed }));
				const answer = () => send(200, { users });
				return upstream.lookupDelayMs > 0 ? setTimeout(answer, upstream.lookupDelayMs) : answer();
			}
			if (path === '/auth/v1/verify' && parsed.type === 'magiclink') {
				return send(200, { access_token: 'at-code', refresh_token: 'rt-code', token_type: 'bearer', expires_in: 3600, user: { id: 'u1', email: upstream.magicEmail } });
			}
			if (path.startsWith('/rest/v1/users') && request.method === 'GET') {
				const taken = upstream.existingEmails.some((email) => decodeURIComponent(path).includes(`email=eq.${email}`));
				return send(200, taken ? [{ id: 'p1' }] : []);
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

// Starts the real gateway once and resolves on "listening" or on exit, so a refused boot shows its exit code.
export function boot(env: Record<string, string>) {
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
