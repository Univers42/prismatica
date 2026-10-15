/**
 * The refresh cookie: POST /api/auth/refresh and POST /api/auth/logout.
 *
 * GoTrue's /logout takes an access token, and after a reload the page holds none (it lives in
 * memory only). So logout redeems the HttpOnly refresh cookie for a fresh access token and signs
 * that session out (scope=local): the cookie alone is enough, and replaying it afterwards on
 * /refresh gets 401 (verdict B, C10). The refresh token never appears in a response body.
 */

export const REFRESH_COOKIE = 'prismatica_refresh';
const COOKIE_ATTRIBUTES = 'HttpOnly; SameSite=Lax; Secure; Path=/api/auth';
const THIRTY_DAYS_SEC = 60 * 60 * 24 * 30;

export function refreshCookie(token) {
	return `${REFRESH_COOKIE}=${encodeURIComponent(token)}; ${COOKIE_ATTRIBUTES}; Max-Age=${THIRTY_DAYS_SEC}`;
}

export function clearRefreshCookie() {
	return `${REFRESH_COOKIE}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`;
}

/** The decoded refresh token from a Cookie header, or '' (a malformed escape reads as none). */
export function refreshTokenFrom(cookieHeader) {
	const raw = String(cookieHeader ?? '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE}=`))?.slice(REFRESH_COOKIE.length + 1) ?? '';
	try {
		return decodeURIComponent(raw);
	} catch {
		return '';
	}
}

function withoutRefreshToken(payload) {
	const safe = { ...payload };
	delete safe.refresh_token;
	return safe;
}

export function createSessionFlows({ gotrue, audit }) {
	return {
		async refresh(refreshToken) {
			if (!refreshToken) return { status: 200, body: { message: 'No refresh session.' } };
			const result = await gotrue.refresh(refreshToken);
			audit(result.ok ? 'refresh_success' : 'refresh_failed', { status: result.status });
			if (!result.ok) return { status: 401, body: { message: 'Refresh session expired.' }, headers: { 'set-cookie': clearRefreshCookie() } };
			const next = typeof result.body.refresh_token === 'string' ? result.body.refresh_token : refreshToken;
			return { status: 200, body: withoutRefreshToken(result.body), headers: { 'set-cookie': refreshCookie(next) } };
		},

		async logout(refreshToken) {
			const cleared = { 'set-cookie': clearRefreshCookie() };
			if (!refreshToken) return { status: 200, body: { message: 'Signed out.', revoked: false }, headers: cleared };
			const redeemed = await gotrue.refresh(refreshToken);
			let revoked = false;
			if (redeemed.ok && typeof redeemed.body.access_token === 'string') {
				revoked = (await gotrue.logout(redeemed.body.access_token, 'local')).ok;
			}
			audit('logout', { revoked, status: redeemed.status });
			return { status: 200, body: { message: 'Signed out.', revoked }, headers: cleared };
		},
	};
}
