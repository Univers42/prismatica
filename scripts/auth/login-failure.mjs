function isUnconfirmed(body) {
	if (body === null || typeof body !== 'object') return false;
	if (body.error_code === 'email_not_confirmed') return true;
	return [body.msg, body.message].some((text) => typeof text === 'string' && /email not confirmed/i.test(text));
}

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
 * GoTrue v2.188.1 answers 400 {"error_code":"email_not_confirmed"} only after the password
 * matched, so naming it leaks nothing an attacker without the password could use: 'unconfirmed'.
 * Caveat: the message fallback ("Email not confirmed") is English-only text from GoTrue; a
 * release that drops error_code and rewords the message reads as a plain wrong password.
 *
 * @param {number} status HTTP status of the failed upstream answer
 * @param {unknown} [body] parsed JSON body of that answer
 * @returns {'credentials' | 'unconfirmed' | 'rate-limited' | 'upstream'}
 */
export function classifyLoginFailure(status, body) {
	if (status === 400 && isUnconfirmed(body)) return 'unconfirmed';
	if (status === 400 || status === 422) return 'credentials';
	if (status === 429) return 'rate-limited';
	return 'upstream';
}
