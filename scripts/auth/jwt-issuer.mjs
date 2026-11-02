/**
 * Access-token issuer checks for the auth gateway.
 *
 * GoTrue stamps `iss` from API_EXTERNAL_URL / GOTRUE_JWT_ISSUER. A production
 * deployment that still uses https://localhost:8443/auth/v1 leaks a non-prod
 * issuer into every access token (issue: production JWT issuer localhost).
 *
 * On a public https origin we refuse those tokens at the gateway so a
 * misconfigured GoTrue cannot quietly ship localhost issuers to clients.
 * Local / private origins are unchanged.
 */

/** @param {string} token */
export function decodeJwtPayload(token) {
	if (typeof token !== 'string') return null;
	const parts = token.split('.');
	if (parts.length < 2) return null;
	try {
		const json = Buffer.from(parts[1], 'base64url').toString('utf8');
		const payload = JSON.parse(json);
		return payload !== null && typeof payload === 'object' ? payload : null;
	} catch {
		return null;
	}
}

/**
 * True when the issuer is a loopback / local-dev auth origin.
 * @param {unknown} iss
 */
export function isLocalhostJwtIssuer(iss) {
	if (typeof iss !== 'string' || !iss.trim()) return true;
	let url;
	try {
		url = new URL(iss);
	} catch {
		return /localhost|127\.0\.0\.1|\[::1\]/i.test(iss);
	}
	const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
	return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
}

/**
 * On a public production site origin, access tokens must not carry a localhost issuer.
 * @param {string} accessToken
 * @param {{ productionOrigin: boolean }} options
 * @returns {{ ok: true, payload: object|null } | { ok: false, reason: string }}
 */
export function assertProductionAccessTokenIssuer(accessToken, { productionOrigin }) {
	if (!productionOrigin) return { ok: true, payload: decodeJwtPayload(accessToken) };
	const payload = decodeJwtPayload(accessToken);
	if (!payload) return { ok: false, reason: 'unreadable_token' };
	if (isLocalhostJwtIssuer(payload.iss)) return { ok: false, reason: 'localhost_issuer' };
	return { ok: true, payload };
}
