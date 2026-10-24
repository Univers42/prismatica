/**
 * The GoTrue calls behind the account flows, through Kong (`${baseUrl}/auth/v1/...`).
 * Every method resolves to `{ ok, status, body }` and never throws: a network failure is
 * status 0, an unreadable body is `{}`. Work queued after a 202 therefore cannot turn a GoTrue
 * outage into an unhandled rejection (verdict B, B12).
 * Plain fetch, not the SDK: this gateway needs the status and body of every answer, never a throw.
 *
 * Caveat: `timeoutMs` (8 s) is a guess at "GoTrue is down"; a slower healthy answer reads as
 * a failure (status 0). `findUserByEmail` sends GoTrue's `filter` (a substring match) and then
 * compares the address exactly, over at most LOOKUP_MAX_PAGES pages: a GoTrue that ignores the
 * filter and holds more users than that reads as "not found" (fails closed, never opens).
 */

const LOOKUP_PAGE_SIZE = 50;
const LOOKUP_MAX_PAGES = 5;

async function readBody(response) {
	try {
		const parsed = await response.json();
		return parsed !== null && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

export function createGotrueApi({ baseUrl, anonKey, serviceKey, fetch: fetchImpl = globalThis.fetch, timeoutMs = 8_000 }) {
	const root = String(baseUrl).replace(/\/+$/, '');

	async function call(path, { method = 'POST', body, bearer = anonKey, admin = false } = {}) {
		if (admin && !serviceKey) return { ok: false, status: 0, body: { message: 'Missing service role key.' } };
		const key = admin ? serviceKey : anonKey;
		const headers = { apikey: key, authorization: `Bearer ${admin ? serviceKey : bearer}`, accept: 'application/json' };
		if (body !== undefined) headers['content-type'] = 'application/json';
		try {
			const response = await fetchImpl(`${root}${path}`, {
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body),
				signal: AbortSignal.timeout(timeoutMs),
			});
			return { ok: response.ok, status: response.status, body: await readBody(response) };
		} catch {
			return { ok: false, status: 0, body: {} };
		}
	}

	const id = (value) => encodeURIComponent(String(value));

	/** The confirmed user whose address is exactly `email` (lowercase), or null. A lookup error is null too. */
	async function findUserByEmail(email) {
		const wanted = String(email).trim().toLowerCase();
		for (let page = 1; page <= LOOKUP_MAX_PAGES; page += 1) {
			const result = await call(`/auth/v1/admin/users?page=${page}&per_page=${LOOKUP_PAGE_SIZE}&filter=${id(wanted)}`, { method: 'GET', admin: true });
			const users = result.ok && Array.isArray(result.body.users) ? result.body.users : [];
			const match = users.find((user) => String(user?.email ?? '').toLowerCase() === wanted);
			if (match) return typeof match.email_confirmed_at === 'string' && match.email_confirmed_at !== '' ? match : null;
			if (users.length < LOOKUP_PAGE_SIZE) return null;
		}
		return null;
	}

	return {
		findUserByEmail,
		verify: (type, tokenHash) => call('/auth/v1/verify', { body: { type, token_hash: tokenHash } }),
		refresh: (refreshToken) => call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: refreshToken } }),
		logout: (accessToken, scope) => call(`/auth/v1/logout?scope=${scope}`, { bearer: accessToken }),
		updatePassword: (accessToken, password) => call('/auth/v1/user', { method: 'PUT', body: { password }, bearer: accessToken }),
		generateLink: (input) => call('/auth/v1/admin/generate_link', { body: input, admin: true }),
		listFactors: (userId) => call(`/auth/v1/admin/users/${id(userId)}/factors`, { method: 'GET', admin: true }),
		mfaChallenge: (accessToken, factorId) => call(`/auth/v1/factors/${id(factorId)}/challenge`, { body: {}, bearer: accessToken }),
		mfaVerify: (accessToken, factorId, challengeId, code) => call(`/auth/v1/factors/${id(factorId)}/verify`, { body: { challenge_id: challengeId, code }, bearer: accessToken }),
	};
}
