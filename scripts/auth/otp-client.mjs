/**
 * grobase's emailed login code through Kong: `POST ${baseUrl}/v1/auth/otp/request` (route acl
 * baas-admin: `apikey: <service role key>` and nothing else) and `/v1/auth/otp/verify` (public).
 * Neither method throws and neither message carries a header or a response body: the outcome is
 * one of a fixed set of words, so a key or a code cannot reach a log through this module.
 *
 * Caveat: the verify answer carries an HS256 proof signed with GoTrue's JWT secret, which this
 * gateway does not hold (and must not: it would let the gateway mint any user's session). The
 * proof's `otp` claim is compared with the ticket email as a consistency check on the decoded,
 * UNSIGNED payload; the trust rests on this module's own server-to-server call, not on the
 * proof. `timeoutMs` (8 s) is a guess at "grobase is down"; a slower healthy answer reads as
 * 'unavailable'.
 */

const REQUEST_OUTCOMES = new Map([[200, 'sent'], [429, 'rate_limited'], [502, 'send_failed']]);
const VERIFY_OUTCOMES = new Map([[401, 'invalid'], [410, 'expired'], [429, 'locked']]);

function proofClaims(proof) {
	try {
		const claims = JSON.parse(Buffer.from(String(proof).split('.')[1] ?? '', 'base64url').toString('utf8'));
		return claims !== null && typeof claims === 'object' ? claims : {};
	} catch {
		return {};
	}
}

export function createOtpClient({ baseUrl, serviceKey, fetch: fetchImpl = globalThis.fetch, timeoutMs = 8_000 }) {
	const root = String(baseUrl ?? '').replace(/\/+$/, '');

	async function post(path, headers, payload) {
		try {
			return await fetchImpl(`${root}${path}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(timeoutMs),
			});
		} catch {
			return null;
		}
	}

	return {
		/** @returns {Promise<'sent'|'rate_limited'|'send_failed'|'unavailable'>} */
		async request(email) {
			if (!root || !serviceKey) return 'unavailable';
			const response = await post('/v1/auth/otp/request', { apikey: serviceKey }, { email });
			return (response && REQUEST_OUTCOMES.get(response.status)) || 'unavailable';
		},

		/** @returns {Promise<'ok'|'invalid'|'expired'|'locked'|'mismatch'|'unavailable'>} */
		async verify(email, code) {
			if (!root) return 'unavailable';
			const response = await post('/v1/auth/otp/verify', {}, { email, code });
			if (!response) return 'unavailable';
			if (response.status !== 200) return VERIFY_OUTCOMES.get(response.status) ?? 'unavailable';
			const body = await response.json().catch(() => ({}));
			const claims = proofClaims(body?.proof);
			return body?.verified === true && claims.aud === 'otp-proof' && claims.otp === String(email).toLowerCase() ? 'ok' : 'mismatch';
		},
	};
}
