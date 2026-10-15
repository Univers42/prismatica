// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { REFRESH_COOKIE, createSessionFlows } from '../../../scripts/auth/session-flows.mjs';
import { fail, ok } from './fakes';

/** GoTrue's refresh-token rotation and session logout, in memory. */
function statefulGotrue() {
	let serial = 0;
	const tokens = new Map<string, { session: string; spent: boolean }>();
	const access = new Map<string, string>();
	const live = new Set<string>();
	function issue(session: string) {
		serial += 1;
		tokens.set(`rt-${serial}`, { session, spent: false });
		access.set(`at-${serial}`, session);
		return { access_token: `at-${serial}`, refresh_token: `rt-${serial}`, user: { id: 'user-1' } };
	}
	const api = {
		refresh: vi.fn(async (token: string) => {
			const entry = tokens.get(token);
			if (!entry || entry.spent || !live.has(entry.session)) return fail(400, { error_code: 'refresh_token_not_found' });
			entry.spent = true;
			return ok(issue(entry.session));
		}),
		logout: vi.fn(async (accessToken: string, scope: string) => {
			const session = access.get(accessToken);
			if (!session || !live.has(session)) return fail(401);
			if (scope !== 'local') return fail(400, { msg: `unexpected scope ${scope}` });
			live.delete(session);
			return { ok: true, status: 204, body: {} };
		}),
	};
	function signIn() {
		const session = `s-${serial + 1}`;
		live.add(session);
		return issue(session);
	}
	return { api, signIn, live };
}

const cookieHeader = (result: { headers?: Record<string, string> }) => result.headers?.['set-cookie'] ?? '';
const audit = () => undefined;

describe('logout with the cookie alone (C10)', () => {
	it('revokes the session server-side, clears the cookie, and the old cookie then refreshes to 401', async () => {
		const gotrue = statefulGotrue();
		const flows = createSessionFlows({ gotrue: gotrue.api, audit });
		const { refresh_token: cookie } = gotrue.signIn();

		const out = await flows.logout(cookie);
		expect(out.status).toBe(200);
		expect(out.body).toMatchObject({ revoked: true });
		expect(cookieHeader(out)).toMatch(new RegExp(`^${REFRESH_COOKIE}=;.*Max-Age=0`));
		expect(gotrue.api.logout).toHaveBeenCalledWith(expect.stringMatching(/^at-/), 'local');
		expect(gotrue.live.size).toBe(0);

		const replay = await flows.refresh(cookie);
		expect(replay.status).toBe(401);
		expect(cookieHeader(replay)).toContain('Max-Age=0');
	});

	it('needs no access token: the only input is the refresh cookie', async () => {
		const gotrue = statefulGotrue();
		const flows = createSessionFlows({ gotrue: gotrue.api, audit });
		const { refresh_token: cookie } = gotrue.signIn();
		expect(flows.logout.length).toBe(1);
		await flows.logout(cookie);
		expect(gotrue.api.refresh).toHaveBeenCalledWith(cookie);
	});

	it('also revokes the newest token after a rotation (the cookie a reloaded page holds)', async () => {
		const gotrue = statefulGotrue();
		const flows = createSessionFlows({ gotrue: gotrue.api, audit });
		const first = gotrue.signIn();
		const rotated = await flows.refresh(first.refresh_token);
		const current = decodeURIComponent(cookieHeader(rotated).split(';')[0].split('=')[1]);
		await flows.logout(current);
		expect((await flows.refresh(current)).status).toBe(401);
	});

	it('clears the cookie and answers 200 without any call when there is no cookie', async () => {
		const gotrue = statefulGotrue();
		const out = await createSessionFlows({ gotrue: gotrue.api, audit }).logout('');
		expect(out.status).toBe(200);
		expect(cookieHeader(out)).toContain('Max-Age=0');
		expect(gotrue.api.refresh).not.toHaveBeenCalled();
	});

	it('clears the cookie and reports revoked:false when GoTrue cannot be reached', async () => {
		const out = await createSessionFlows({ gotrue: { refresh: async () => fail(0), logout: vi.fn() }, audit }).logout('rt-x');
		expect(out).toMatchObject({ status: 200, body: { revoked: false } });
		expect(cookieHeader(out)).toContain('Max-Age=0');
	});
});

describe('refresh', () => {
	it('rotates the cookie and never returns the refresh token in the body', async () => {
		const gotrue = statefulGotrue();
		const flows = createSessionFlows({ gotrue: gotrue.api, audit });
		const { refresh_token: cookie } = gotrue.signIn();
		const result = await flows.refresh(cookie);
		expect(result.status).toBe(200);
		expect(result.body.refresh_token).toBeUndefined();
		expect(result.body.access_token).toMatch(/^at-/);
		expect(cookieHeader(result)).toMatch(/HttpOnly; SameSite=Lax; Secure; Path=\/api\/auth; Max-Age=2592000$/);
	});

	it('answers 200 "no session" without a cookie', async () => {
		expect((await createSessionFlows({ gotrue: { refresh: vi.fn() }, audit }).refresh('')).status).toBe(200);
	});
});
