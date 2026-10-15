/**
 * Signed e-mail links: the gateway's own HMAC over (type, token_hash, exp).
 *
 * GoTrue's /verify consumes a token before anyone could check its age, so the age is checked
 * here, first: a past `exp` or a bad signature is refused without calling GoTrue at all
 * (docs/redesign/verdicts/phase1-devil.md, Decision B, C1). The token travels in the URL
 * fragment, which no server log or Referer header carries (C2). The key is dedicated to this
 * one use, so a leak of any other secret cannot mint a link.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const LINK_PAGES = Object.freeze({ signup: '/auth/confirm', recovery: '/auth/reset-password' });
export const MIN_KEY_LENGTH = 32;
export const VERIFY_TTL_CEILING_SEC = 86_400;
export const RESET_TTL_CEILING_SEC = 3_600;

// GoTrue's hashed_token is 56 hex characters; the bound leaves room without admitting junk.
const TOKEN_HASH = /^[A-Za-z0-9_-]{16,128}$/;
const EXP = /^\d{1,12}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/;

function mac(key, type, tokenHash, exp) {
	return createHmac('sha256', key).update(`prismatica-link-v1\n${type}\n${tokenHash}\n${exp}`).digest('base64url');
}

/** The base64url HMAC-SHA256 that `checkLink` expects for these three fields. */
export function signLink(key, { type, tokenHash, exp }) {
	return mac(key, type, tokenHash, String(exp));
}

/**
 * Check a link's fields (as posted from the page's fragment) for the expected type.
 * @returns {{ok: true, tokenHash: string, exp: number} | {ok: false, reason: 'unconfigured'|'malformed'|'bad_signature'|'expired'}}
 */
export function checkLink(key, expectedType, fields, nowSec) {
	if (!key) return { ok: false, reason: 'unconfigured' };
	const tokenHash = String(fields?.token_hash ?? '');
	const exp = String(fields?.exp ?? '');
	const sig = String(fields?.sig ?? '');
	const type = String(fields?.type ?? expectedType);
	if (type !== expectedType || !TOKEN_HASH.test(tokenHash) || !EXP.test(exp) || !SIGNATURE.test(sig)) {
		return { ok: false, reason: 'malformed' };
	}
	const expected = Buffer.from(mac(key, expectedType, tokenHash, exp));
	if (!timingSafeEqual(expected, Buffer.from(sig))) return { ok: false, reason: 'bad_signature' };
	if (Number(exp) <= nowSec) return { ok: false, reason: 'expired' };
	return { ok: true, tokenHash, exp: Number(exp) };
}

/** `${siteUrl}/auth/confirm#token_hash=…&type=…&exp=…&sig=…` — never built from a request's Host. */
export function buildLinkUrl(siteUrl, key, { type, tokenHash, exp }) {
	const fragment = new URLSearchParams({ token_hash: tokenHash, type, exp: String(exp), sig: signLink(key, { type, tokenHash, exp }) });
	return `${String(siteUrl).replace(/\/+$/, '')}${LINK_PAGES[type]}#${fragment.toString()}`;
}

/** Why this key must not be used, or null. `others` are the gateway's other secrets. */
export function linkSigningKeyProblem(key, others) {
	if (!key) return 'AUTH_LINK_SIGNING_KEY is not set: e-mail links cannot be signed.';
	if (key.length < MIN_KEY_LENGTH) return `AUTH_LINK_SIGNING_KEY must be at least ${MIN_KEY_LENGTH} characters.`;
	if (others.some((other) => other && other === key)) return 'AUTH_LINK_SIGNING_KEY is reused from another secret; it must be dedicated to e-mail links.';
	return null;
}

function ttl(raw, ceiling) {
	const value = /^\d+$/.test(String(raw ?? '')) ? Number(raw) : 0;
	return value > 0 ? Math.min(value, ceiling) : ceiling;
}

/** Link lifetimes: shorter values are taken as set (pr2 runs with 5 s); longer ones are capped. */
export function linkTtls(env) {
	return {
		verifySec: ttl(env.AUTH_VERIFY_TOKEN_TTL_SEC, VERIFY_TTL_CEILING_SEC),
		resetSec: ttl(env.AUTH_RESET_TOKEN_TTL_SEC, RESET_TTL_CEILING_SEC),
	};
}

/** A lifetime as the mails print it: 86400 → "24 hours", 3600 → "60 minutes", 5 → "5 seconds". */
export function humanDuration(seconds) {
	if (seconds >= 7_200 && seconds % 3_600 === 0) return `${seconds / 3_600} hours`;
	if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} minutes`;
	return `${seconds} seconds`;
}
