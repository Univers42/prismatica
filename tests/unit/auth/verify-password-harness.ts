// The bridge's signed step-up and a verify-password instance over fakes, shared by the module tests.
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { vi } from 'vitest';
import { createVerifyPassword } from '../../../scripts/auth/verify-password.mjs';
import { memoryStore, ok, type Result } from './fakes';

export const SECRET = 'bridge-shared-secret-for-tests-0123456789';
export const PATH = '/api/auth/verify-password';
export const EMAIL = 'ana@arlet.test';
export const LIVE_CHAIN = '203.0.113.66, 198.51.100.7, 100.64.0.1, 172.18.0.1';
export const now = () => Math.floor(Date.now() / 1000);
// GoTrue's access token carries the session it belongs to in the session_id claim.
export const jwt = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
export const MINTED = jwt({ sub: 'user-1', session_id: 'sess-9' });

// The bridge's own lines (osionos main scripts/bridge-account-sudo-password.mjs), byte for byte.
export function bridgeSign(secret: string, timestamp: string, body: string) {
	return createHmac('sha256', secret).update(`${timestamp}.password.${PATH}.${body}`).digest('hex');
}

export type Init = { body?: string; secret?: string; timestamp?: string; signature?: string; chunks?: Buffer[]; url?: string; headers?: Record<string, unknown> };
export function stepUp(init: Init = {}) {
	const body = init.body ?? JSON.stringify({ email: EMAIL, password: 'Right-Pass-1!' });
	const timestamp = init.timestamp ?? String(now());
	const signature = init.signature ?? bridgeSign(init.secret ?? SECRET, timestamp, body);
	const request = Readable.from(init.chunks ?? [Buffer.from(body, 'utf8')]);
	const headers = { 'x-osionos-sudo-timestamp': timestamp, 'x-osionos-sudo-signature': signature, 'x-forwarded-for': LIVE_CHAIN, ...init.headers };
	return Object.assign(request, { url: init.url ?? PATH, headers, socket: { remoteAddress: '172.18.0.5' } });
}

export function harness(options: { secret?: string | undefined; grant?: () => Promise<Result>; logout?: () => Promise<Result>; nowSec?: () => number } = {}) {
	const store = memoryStore();
	const gotrue = {
		passwordGrant: vi.fn(options.grant ?? (async () => ok({ access_token: MINTED, refresh_token: 'rt-minted', user: { id: 'user-1' } }))),
		logout: vi.fn(options.logout ?? (async () => ({ ok: true, status: 204, body: {} }))),
	};
	const audit = vi.fn(async () => undefined);
	const alertFailed = vi.fn();
	const warn = vi.fn();
	const lockout = { threshold: 10, windowSec: 900, lockSec: 900 };
	const verifier = createVerifyPassword({ secret: 'secret' in options ? options.secret : SECRET, store, gotrue, lockout, trustedProxyHops: 2, audit, alertFailed, warn, nowSec: options.nowSec ?? now });
	const events = () => audit.mock.calls.map((call: unknown[]) => ({ type: call[0], details: call[2] as Record<string, unknown> }));
	return { ...verifier, store, gotrue, audit, alertFailed, warn, events };
}

export const BAD_SIGNATURE = { status: 400, body: { error: 'bad_signature' } };
export const INVALID = { status: 401, body: { valid: false } };
export const UNAVAILABLE = { status: 503, body: { error: 'verify_unavailable' } };
