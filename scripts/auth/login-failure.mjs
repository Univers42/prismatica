/**
 * What a failed GoTrue password grant means for the person signing in.
 *
 * GoTrue answers a wrong password and an unknown email with the same 400 (422 for a malformed
 * request), so only those are "credentials" and keep the generic, non-leaking answer. 429 is
 * GoTrue's own rate limit. Every other status never reached the password check: 401 is Kong
 * refusing this gateway's anon key (a stale ./.env.local against another grobase), 403 the WAF,
 * 404 a missing route, 5xx and the SDK's 500 a backend that is down or unreachable. All of them
 * used to come back as "Invalid credentials", so a correct password on a misconfigured link
 * read as a wrong one, with nothing in any console (groot, 2026-10-12).
 *
 * @param {number} status HTTP status of the failed upstream answer
 * @returns {'credentials' | 'rate-limited' | 'upstream'}
 */
export function classifyLoginFailure(status) {
	if (status === 400 || status === 422) return 'credentials';
	if (status === 429) return 'rate-limited';
	return 'upstream';
}
