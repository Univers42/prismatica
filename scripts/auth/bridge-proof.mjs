// The osionos bridge's word that it verified a sign-in's Turnstile token itself (#50). Cloudflare
// tokens are single-use, so the gateway cannot siteverify a token the bridge already spent; the
// bridge sends this proof instead, and only after its own siteverify succeeded.
//
// Caveat: a trust delegation. Whoever holds OSIONOS_BRIDGE_SHARED_SECRET can sign a proof and skip
// the CAPTCHA, so the proof is exactly as strong as that secret. A proof binds the second, the
// path and the whole body (password included) and is accepted once, so a captured one can only
// repeat an identical request within the window. Single-use holds across gateway replicas only
// with Redis; the in-memory store is per process.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const BRIDGE_PROOF_HEADER = 'x-osionos-bridge-proof';
export const BRIDGE_PROOF_WINDOW_SEC = 60;
const USED_TTL_SEC = 2 * BRIDGE_PROOF_WINDOW_SEC;
const PROOF = /^(\d{1,12})\.([0-9a-f]{64})$/;

/** Keys sorted at every depth, so both sides of a signature serialise one body identically. */
export function stableStringify(value) {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	const entries = Object.keys(value)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => JSON.stringify(key) + ':' + stableStringify(value[key]));
	return '{' + entries.join(',') + '}';
}

// The whole body is signed, the spent Turnstile token included: each attempt carries its own
// single-use token, so two identical sign-ins in one second still get two distinct proofs.
function proofDigest(secret, timestamp, path, body) {
	return createHmac('sha256', secret).update(`${timestamp}.turnstile.${path}.${stableStringify(body ?? {})}`).digest('hex');
}

/** The header value the bridge sends with `body` to `path`, signed at `nowSec`. */
export function signBridgeProof(secret, path, body, nowSec = Math.floor(Date.now() / 1000)) {
	return `${nowSec}.${proofDigest(secret, nowSec, path, body)}`;
}

/**
 * True only for a proof signed with `secret` over this path and body, within the window, never
 * seen before. Each accepted proof is recorded in `store` for twice the window.
 */
export async function acceptBridgeProof({ header, secret, path, body, store, nowSec = Math.floor(Date.now() / 1000) }) {
	if (!secret || typeof header !== 'string') return false;
	const match = PROOF.exec(header);
	if (!match) return false;
	const timestamp = Number(match[1]);
	if (Math.abs(nowSec - timestamp) > BRIDGE_PROOF_WINDOW_SEC) return false;
	const expected = Buffer.from(proofDigest(secret, timestamp, path, body), 'hex');
	if (!timingSafeEqual(expected, Buffer.from(match[2], 'hex'))) return false;
	return store.setIfAbsent(`bridgeproof:${match[2]}`, '1', USED_TTL_SEC);
}
