/**
 * After a password reset, records `sessions_valid_after` for the user in
 * public.auth_session_cutoffs (groot models/auth-session-cutoffs.sql, service_role only). The
 * osionos bridge refuses an osionos_v1 token issued before it (verdict B, C8); GoTrue's own
 * refresh tokens are revoked separately by /logout?scope=global.
 *
 * Caveat: the time is this gateway's clock, compared by the bridge with tokens stamped by its
 * own clock; skew between the two hosts moves the cut-off by that much.
 */

export function createSessionCutoffWriter({ baasUrl, serviceKey, fetch: fetchImpl = globalThis.fetch, timeoutMs = 8_000 }) {
	const url = `${String(baasUrl).replace(/\/+$/, '')}/rest/v1/auth_session_cutoffs?on_conflict=user_id`;
	return async function writeCutoff(userId, validAfterIso) {
		if (!serviceKey) return false;
		try {
			const response = await fetchImpl(url, {
				method: 'POST',
				headers: {
					apikey: serviceKey,
					authorization: `Bearer ${serviceKey}`,
					'content-type': 'application/json',
					prefer: 'resolution=merge-duplicates,return=minimal',
				},
				body: JSON.stringify({ user_id: userId, sessions_valid_after: validAfterIso }),
				signal: AbortSignal.timeout(timeoutMs),
			});
			return response.ok;
		} catch {
			return false;
		}
	};
}
