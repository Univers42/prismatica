// POST /api/auth/verify-password: the osionos bridge's sudo step-up asks whether a password is
// right (osionos #234/#232; devil ruling 2026-11-22, VP1–VP22). The gateway answers because it
// owns the per-account login lockout, the failed-sign-in alert and the audit trail, so a step-up
// spends the same guess budget as /login. Callers: osionos scripts/bridge-account-sudo-password.mjs.
//
// The route is reachable from the internet by its /api/auth prefix, so the HMAC is the only guard
// in front of a password oracle. Every signature failure is therefore refused before any write,
// GoTrue call or audit row, and answers 400, which the bridge reads as "unavailable": a 401/403
// would tell the user their password is wrong during a secret rotation or a clock skew.
//
// Caveat: a trust delegation, like bridge-proof.mjs. Whoever holds OSIONOS_BRIDGE_SHARED_SECRET
// can ask about any account's password, within the per-account lockout. Single-use of a signature
// holds across replicas only with Redis; the in-memory store is per process.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { EMAIL_REGEX, loginLockKeys, normalizeEmail } from './identity.mjs';
import { classifyLoginFailure } from './login-failure.mjs';
import { deriveClientIp } from './net-ip.mjs';

export const VERIFY_PASSWORD_PATH = '/api/auth/verify-password';
export const VERIFY_PASSWORD_BODY_CAP = 8 * 1024;
// Caveat: a guess at "GoTrue is down". Grant plus revoke (7 s) must fit the bridge's 8 s timeout,
// so a grant slower than 3.5 s reads as unavailable (503), never as a wrong password.
export const VERIFY_PASSWORD_GOTRUE_TIMEOUT_MS = 3_500;
const MIN_SECRET_LENGTH = 32;
const TIMESTAMP_HEADER = 'x-osionos-sudo-timestamp';
const SIGNATURE_HEADER = 'x-osionos-sudo-signature';
const WINDOW_SEC = 60;
const REPLAY_TTL_SEC = 2 * WINDOW_SEC;
const WARN_EVERY_SEC = 60;
const TIMESTAMP = /^\d{1,12}$/;
const SIGNATURE = /^[0-9a-f]{64}$/;

const BAD_SIGNATURE = { status: 400, body: { error: 'bad_signature' } };
const BAD_REQUEST = { status: 400, body: { error: 'bad_request' } };
const INVALID = { status: 401, body: { valid: false } };
const UNCONFIRMED = { status: 403, body: { valid: false } };
const TOO_LARGE = { status: 413, body: { error: 'body_too_large' } };
const UNAVAILABLE = { status: 503, body: { error: 'verify_unavailable' } };
const VERIFIED = { status: 200, body: { valid: true } };

/**
 * The step-up's client address. The bridge appends its own socket peer to x-forwarded-for, one
 * entry right of what the gateway's trusted proxies would leave, so the hop count is one more.
 *
 * Caveat: assumes the bridge sits behind as many appending proxies as the gateway's direct path
 * (AUTH_TRUSTED_PROXY_HOPS). A bridge reached through another count, such as the beta edge in
 * front of the prod bridge, names a proxy (one more hop) or a client-written entry (one fewer).
 * Nothing is limited on this address (VP7), so a wrong one misleads the audit row only.
 */
export function stepUpClientIp(request, trustedProxyHops) {
	return deriveClientIp(request, { trustedProxyHops: Number(trustedProxyHops) + 1 });
}

/** True when OSIONOS_BRIDGE_SHARED_SECRET is too short to sign with: a guessable key forges any step-up. */
export function isWeakBridgeSecret(secret) {
	return String(secret ?? '').trim().length < MIN_SECRET_LENGTH;
}

/** The body's exact bytes, never decoded chunk by chunk: a code point split across two chunks stays whole. */
export async function readRawBody(request, cap = VERIFY_PASSWORD_BODY_CAP) {
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		size += chunk.length;
		if (size > cap) throw Object.assign(new Error('Request body too large.'), { status: 413 });
		chunks.push(chunk);
	}
	return Buffer.concat(chunks, size);
}

function headerOf(request, name) {
	const value = request.headers?.[name];
	return typeof value === 'string' ? value : '';
}

/** The timestamp and signature headers, or null when either is malformed or outside the window. */
function signedHeaders(request, nowSec) {
	const timestamp = headerOf(request, TIMESTAMP_HEADER);
	const signature = headerOf(request, SIGNATURE_HEADER);
	if (!TIMESTAMP.test(timestamp) || !SIGNATURE.test(signature)) return null;
	if (Math.abs(nowSec - Number(timestamp)) > WINDOW_SEC) return null;
	return { timestamp, signature };
}

// The path is the constant the bridge signs, never request.url: a proxy may rewrite the URL.
function signatureMatches(secret, { timestamp, signature }, raw) {
	const expected = createHmac('sha256', secret).update(`${timestamp}.password.${VERIFY_PASSWORD_PATH}.`).update(raw).digest();
	return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

/** `{ email, password }` from a signed body, or null when it is not a JSON object. */
function parseCredentials(raw) {
	let body;
	try {
		body = JSON.parse(raw.toString('utf8'));
	} catch {
		return null;
	}
	if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
	return { email: typeof body.email === 'string' ? normalizeEmail(body.email) : '', password: body.password };
}

/** The `session_id` claim of a GoTrue access token, or '' when it cannot be read. */
function sessionIdOf(accessToken) {
	try {
		const claims = JSON.parse(Buffer.from(String(accessToken).split('.')[1] ?? '', 'base64url').toString('utf8'));
		return typeof claims?.session_id === 'string' ? claims.session_id : '';
	} catch {
		return '';
	}
}

// Caveat: sampled. One warning a minute carries the count since the last one; a burst that
// stops leaves its tail unreported until the next refusal.
function refuseSignature(deps, reason) {
	const refusals = deps.refusals;
	refusals.count += 1;
	const now = deps.nowSec();
	if (now - refusals.lastWarnSec < WARN_EVERY_SEC) return BAD_SIGNATURE;
	deps.warn(`[auth-gateway] verify-password: refused ${refusals.count} request(s) with a bad signature, the last for "${reason}"`);
	refusals.lastWarnSec = now;
	refusals.count = 0;
	return BAD_SIGNATURE;
}

async function verify(deps, request) {
	if (isWeakBridgeSecret(deps.secret)) return UNAVAILABLE;
	const signed = signedHeaders(request, deps.nowSec());
	if (!signed) return refuseSignature(deps, 'header');
	const raw = await readRawBody(request);
	if (!signatureMatches(deps.secret, signed, raw)) return refuseSignature(deps, 'mismatch');
	if (!(await deps.store.setIfAbsent(`sudoproof:${signed.signature}`, '1', REPLAY_TTL_SEC))) return refuseSignature(deps, 'replay');
	const credentials = parseCredentials(raw);
	if (!credentials) return BAD_REQUEST;
	if (!EMAIL_REGEX.test(credentials.email) || typeof credentials.password !== 'string' || credentials.password === '') return INVALID;
	return checkPassword(deps, request, credentials);
}

/** The lockout-gated GoTrue check behind a valid signature. */
async function checkPassword(deps, request, { email, password }) {
	const attempt = { deps, request, email, ip: stepUpClientIp(request, deps.trustedProxyHops), keys: loginLockKeys(email) };
	const lockRemainingMs = await deps.store.pttl(attempt.keys.lock);
	if (lockRemainingMs > 0) {
		await deps.audit('sudo_password_locked', request, { email, ip_address: attempt.ip });
		return { status: 429, body: { error: 'locked' }, headers: { 'retry-after': String(Math.ceil(lockRemainingMs / 1000)) } };
	}
	const grant = await deps.gotrue.passwordGrant(email, password);
	return grant.ok ? verified(attempt, grant.body) : refused(attempt, grant);
}

// Only the failure count is cleared: a lock a concurrent attempt set during the grant stays (VP12).
// The revoke goes first: a stalled store must not keep a refresh token nobody holds alive.
async function verified(attempt, session) {
	const { store, audit } = attempt.deps;
	const revoked = await revokeMinted(attempt, session);
	await store.del(attempt.keys.fail);
	await audit('sudo_password_verified', attempt.request, { email: attempt.email, ip_address: attempt.ip, revoked });
	return VERIFIED;
}

// The grant minted a real session with a refresh token nobody holds; end it at once, and only it.
async function revokeMinted(attempt, session) {
	const token = typeof session?.access_token === 'string' ? session.access_token : '';
	const result = token ? await attempt.deps.gotrue.logout(token, 'local') : { ok: false, status: 0 };
	if (result.ok) return true;
	const userId = typeof session?.user?.id === 'string' ? session.user.id : '';
	await attempt.deps.audit('sudo_password_session_revoke_failed', attempt.request, { email: attempt.email, ip_address: attempt.ip, user_id: userId, session_id: sessionIdOf(token), status: result.status });
	return false;
}

async function refused(attempt, grant) {
	const failure = classifyLoginFailure(grant.status, grant.body);
	if (failure === 'unconfirmed') return UNCONFIRMED;
	if (failure !== 'credentials') {
		console.error(`[auth-gateway] verify-password: the auth service answered HTTP ${grant.status}; the password was not checked`);
		return UNAVAILABLE;
	}
	await countFailure(attempt);
	// Caveat: the alert names the address and browser of the request it is given, which for a
	// step-up is the bridge's call (the gateway's own hop count, the bridge's user agent), not the
	// user's; the audit row below carries the step-up address.
	attempt.deps.alertFailed(attempt.request, attempt.email);
	await attempt.deps.audit('sudo_password_failed', attempt.request, { email: attempt.email, ip_address: attempt.ip, status: grant.status });
	return INVALID;
}

async function countFailure({ deps, request, email, ip, keys }) {
	const failures = await deps.store.incrWithTtl(keys.fail, deps.lockout.windowSec);
	if (failures < deps.lockout.threshold) return;
	await deps.store.set(keys.lock, '1', deps.lockout.lockSec);
	await deps.store.del(keys.fail);
	await deps.audit('sudo_password_lockout_triggered', request, { email, ip_address: ip, failures });
}

/**
 * The route's handler: `handle(request)` resolves to `{ status, body, headers? }` and never
 * throws. Bodies are `{ valid }` or `{ error }` only; no answer carries a token, a user or a cookie.
 * Dependencies: secret, store, gotrue (passwordGrant, logout), lockout { threshold, windowSec,
 * lockSec }, trustedProxyHops, audit(event, request, details), alertFailed(request, email).
 */
export function createVerifyPassword(options) {
	const deps = { warn: console.warn, nowSec: () => Math.floor(Date.now() / 1000), ...options, refusals: { count: 0, lastWarnSec: Number.NEGATIVE_INFINITY } };
	/** @returns {Promise<{ status: number, body: { valid: boolean } | { error: string }, headers?: Record<string, string> }>} */
	async function handle(request) {
		try {
			return await verify(deps, request);
		} catch (error) {
			if (error?.status === 413) return TOO_LARGE;
			console.error(`[auth-gateway] verify-password: ${error instanceof Error ? error.message : 'unknown error'}; the password was not checked`);
			return UNAVAILABLE;
		}
	}
	return { handle };
}
