// @vitest-environment node
// The existing-account link (verdict C341–C355, C374–C381) against a recorded GoTrue/PostgREST
// double: the decision, the observe mode's zero mutations, the reset order with the marker last,
// and every failure answering 503 without a marker.
import { describe, expect, it, vi } from 'vitest';
import { createOauthLink, decide, markerValid, parseLinkMode } from '../../../scripts/auth/oauth-link.mjs';
import { fail, memoryStore, ok, type Result } from './fakes';

const EMAIL = 'ines@arlet.test';
const NOW = Date.parse('2026-10-27T12:00:00Z');
const emailIdentity = { provider: 'email', identity_data: { email: EMAIL } };
const googleIdentity = { provider: 'google', identity_data: { email: EMAIL, email_verified: true } };
const account = (extra: Record<string, unknown> = {}) => ({ id: 'u1', email: EMAIL, phone: '', identities: [emailIdentity, googleIdentity], app_metadata: { provider: 'email' }, ...extra });
const marker = (by: string, email = EMAIL) => ({ app_metadata: { mailbox_proof: { at: 'x', email, by } } });

type Knobs = { user?: Record<string, unknown>; reread?: Record<string, unknown>; factors?: unknown[] | null; refactors?: unknown[]; status?: Record<string, number> };

function harness(knobs: Knobs = {}, mode = 'on') {
	const log: string[] = [];
	const audits: { event: string; details: Record<string, any> }[] = [];
	let clock = NOW;
	// GoTrue's admin password update ends every session of the user (live 2026-10-27: the provider
	// session's own logout then answered 403 "Session not found").
	let sessionsEnded = false;
	const afterLogout = () => log.includes('logout others');
	const answer = (name: string, body: unknown = {}): Result => (knobs.status?.[name] ? fail(knobs.status[name]) : ok(body as Record<string, any>));
	const gotrue = {
		getUser: vi.fn(async () => {
			log.push('GET user');
			return answer('getUser', afterLogout() && knobs.reread ? knobs.reread : (knobs.user ?? account()));
		}),
		listFactors: vi.fn(async () => {
			log.push('GET factors');
			if (knobs.factors === null) return fail(500);
			return ok((afterLogout() ? (knobs.refactors ?? []) : (knobs.factors ?? [])) as any);
		}),
		updateUser: vi.fn(async (_id: string, body: Record<string, unknown>) => {
			const marking = 'app_metadata' in body;
			log.push(marking ? 'PUT marker' : 'PUT password');
			if (!marking) sessionsEnded = true;
			return answer(marking ? 'marker' : 'rotate');
		}),
		deleteFactor: vi.fn(async (_id: string, factorId: string) => (log.push(`DELETE factor ${factorId}`), answer('deleteFactor'))),
		logout: vi.fn(async (_token: string, scope: string) => (log.push(`logout ${scope}`), sessionsEnded ? fail(403) : answer('logout'))),
		serviceRest: vi.fn(async (path: string, init: { method?: string } = {}) => {
			const table = path.split('?')[0];
			log.push(`${init.method ?? 'GET'} ${table}`);
			if (init.method === 'PATCH') return answer(table, [{ id: 't1' }]);
			return ok((path.includes('role=eq.owner') ? [{ workspace_id: 'w1' }] : [{ user_id: 'x' }, { user_id: 'y' }]) as any);
		}),
	};
	const writeCutoff = vi.fn(async (_id: string, at: string) => (log.push(`cutoff ${at}`), knobs.status?.cutoff ? false : true));
	const notifyLinked = vi.fn(() => log.push('notice'));
	const store = memoryStore();
	const link = createOauthLink({
		gotrue,
		store,
		writeCutoff,
		notifyLinked,
		audit: (event: string, details: Record<string, any>) => audits.push({ event, details }),
		mode,
		nowMs: () => (clock += 1000),
		newSecret: () => 'secret-' + Math.random().toString(36).slice(2),
	});
	const run = () => link.link({ userId: 'u1', accessToken: 'at', email: EMAIL });
	const mutations = () => log.filter((entry) => !entry.startsWith('GET'));
	return { gotrue, log, audits, store, run, mutations, writeCutoff, notifyLinked, advance: (ms: number) => (clock += ms) };
}

describe('parseLinkMode', () => {
	it('defaults to off, accepts off/observe/on in any case, and refuses anything else at boot', () => {
		expect(parseLinkMode(undefined)).toBe('off');
		expect(parseLinkMode(' Observe ')).toBe('observe');
		expect(parseLinkMode('on')).toBe('on');
		expect(() => parseLinkMode('yes')).toThrow(/off, observe, on/);
	});
});

describe('markerValid (C378)', () => {
	it('accepts only a reset marker bound to the current address', () => {
		expect(markerValid(account(marker('password_reset')))).toBe(true);
		expect(markerValid(account({ ...marker('oauth_link_reset', 'INES@arlet.test') }))).toBe(true);
		expect(markerValid(account(marker('x')))).toBe(false);
		expect(markerValid(account(marker('password_reset', 'other@arlet.test')))).toBe(false);
		expect(markerValid(account({ app_metadata: { mailbox_proof: { by: 'password_reset' } } }))).toBe(false);
	});
});

describe('decide (C345–C347)', () => {
	it('rotates an email account a verified same-address provider joined, unless the mailbox is proven', () => {
		expect(decide(account(), [])).toEqual({ rotate: true });
		expect(decide(account(marker('password_reset')), [])).toEqual({ rotate: false });
		expect(decide(account({ identities: [googleIdentity] }), [])).toEqual({ rotate: false });
	});

	it.each([
		['a provider proving another address', { identities: [emailIdentity, { ...googleIdentity, identity_data: { email: 'b@arlet.test', email_verified: true } }] }, 'unverified_identity'],
		['an unverified provider address', { identities: [emailIdentity, { ...googleIdentity, identity_data: { email: EMAIL } }] }, 'unverified_identity'],
		['a provider outside the allowlist', { identities: [emailIdentity, { provider: 'discord', identity_data: { email: EMAIL, email_verified: true } }] }, 'unverified_identity'],
		['a pending email change', { new_email: 'b@arlet.test' }, 'pending_email_change'],
		['a phone', { phone: '33600000000' }, 'phone'],
		['an anonymous user', { is_anonymous: true }, 'anonymous'],
		['a ban in force', { banned_until: '2999-01-01T00:00:00Z' }, 'banned'],
		['no identities', { identities: [] }, 'unreadable'],
	])('refuses %s', (_name, extra, reason) => {
		expect(decide(account(extra), [])).toEqual({ refuse: reason });
	});

	it('refuses unreadable factors and asks a verified-factor account for its own sign-in', () => {
		expect(decide(account(), null)).toEqual({ refuse: 'unreadable' });
		expect(decide(account(), [{ id: 'f1', status: 'verified' }])).toEqual({ mfa: true });
		expect(decide(account(), [{ id: 'f1', status: 'unverified' }])).toEqual({ rotate: true });
	});
});

describe('link, off and observe (C353, C354, C380)', () => {
	it('off answers the collision without a single call', async () => {
		const h = harness({}, 'off');
		expect(await h.run()).toMatchObject({ status: 409, body: { error: 'oauth_email_collision' } });
		expect(h.log).toEqual([]);
	});

	it('observe reads, probes both token tables, audits the would-be reset, mutates nothing and still refuses', async () => {
		const h = harness({}, 'observe');
		expect(await h.run()).toMatchObject({ status: 409, body: { error: 'oauth_email_collision' } });
		expect(h.mutations()).toEqual([]);
		expect(h.writeCutoff).not.toHaveBeenCalled();
		expect(h.store.map.size).toBe(0);
		expect(h.audits).toEqual([{ event: 'oauth_link_refused', details: expect.objectContaining({ reason: 'observe', would_reset: true, would_refuse_reason: null, ai_tokens_status: 200, pats_status: 200 }) }]);
	});
});

describe('link, on', () => {
	it('lets a proven mailbox in without touching a credential', async () => {
		const h = harness({ user: account(marker('password_reset')) });
		expect(await h.run()).toEqual({ allow: true, credentialReset: false });
		expect(h.mutations()).toEqual([]);
		expect(h.audits[0]).toMatchObject({ event: 'oauth_account_linked', details: { credential_reset: false, providers: ['email', 'google'] } });
	});

	it('resets in order, stamps the cut-off after the logout, and writes the marker last (C343, C347, C352, C376)', async () => {
		const h = harness({ factors: [{ id: 'f9', status: 'unverified' }] });
		expect(await h.run()).toEqual({ allow: true, credentialReset: true });
		const cutoff = h.log.find((entry) => entry.startsWith('cutoff'));
		expect(h.mutations()).toEqual([
			'logout others',
			'PUT password',
			'DELETE factor f9',
			cutoff,
			'PATCH ai_access_tokens',
			'PATCH osionos_personal_access_tokens',
			'notice',
			'PUT marker',
		]);
		expect(h.log.indexOf(cutoff!)).toBeGreaterThan(h.log.indexOf('logout others'));
		expect(h.gotrue.serviceRest).toHaveBeenCalledWith(expect.stringContaining('osionos_personal_access_tokens?user_id=eq.u1&revoked_at=is.null'), expect.objectContaining({ body: expect.objectContaining({ revoked_reason: 'admin' }) }));
		const markerBody = h.gotrue.updateUser.mock.calls.at(-1)?.[1] as any;
		expect(markerBody.app_metadata.mailbox_proof).toMatchObject({ email: EMAIL, by: 'oauth_link_reset' });
		expect(h.notifyLinked).toHaveBeenCalledWith(EMAIL, { ai_tokens_revoked: 1, pats_revoked: 1, workspace_members_to_review: 2 });
		expect(h.audits.at(-1)).toMatchObject({ event: 'oauth_account_linked', details: { credential_reset: true, ai_tokens_revoked: 1, pats_revoked: 1, workspace_members_to_review: 2, marker_written: true } });
		expect(h.store.map.size).toBe(0);
	});

	it.each([
		['the rotation', { status: { rotate: 500 } }, 'rotate'],
		['the logout', { status: { logout: 500 } }, 'logout'],
		['the cut-off twice', { status: { cutoff: 1 } }, 'cutoff'],
		['the AI token revoke', { status: { ai_access_tokens: 404 } }, 'revoke_ai_access_tokens'],
		['the personal token revoke', { status: { osionos_personal_access_tokens: 403 } }, 'revoke_osionos_personal_access_tokens'],
		['an email change started meanwhile', { reread: account({ new_email: 'b@arlet.test' }) }, 'account_changed'],
		['a factor enrolled meanwhile', { refactors: [{ id: 'f2', status: 'verified' }] }, 'account_changed'],
	])('answers 503 without a marker when %s fails (C343, C377, C379)', async (_name, knobs, stage) => {
		const h = harness(knobs as Knobs);
		expect(await h.run()).toMatchObject({ status: 503, body: { error: 'oauth_link_reset_failed' } });
		expect(h.log).not.toContain('PUT marker');
		expect(h.audits.at(-1)).toEqual({ event: 'oauth_link_reset_failed', details: expect.objectContaining({ stage }) });
		expect(h.store.map.size).toBe(0);
	});

	it('retries the cut-off once', async () => {
		const h = harness();
		h.writeCutoff.mockResolvedValueOnce(false);
		expect(await h.run()).toEqual({ allow: true, credentialReset: true });
		expect(h.writeCutoff).toHaveBeenCalledTimes(2);
	});

	it('stops at the deadline before the marker (C374)', async () => {
		const h = harness();
		h.gotrue.logout.mockImplementationOnce(async () => (h.advance(30_000), ok()));
		expect(await h.run()).toMatchObject({ status: 503 });
		expect(h.audits.at(-1)?.details.stage).toBe('deadline');
		expect(h.log).not.toContain('PUT marker');
	});

	it('keeps a completed reset when only the marker write fails, and says so (C378)', async () => {
		const h = harness({ status: { marker: 500 } });
		expect(await h.run()).toEqual({ allow: true, credentialReset: true });
		expect(h.audits.at(-1)?.details.marker_written).toBe(false);
	});

	it('refuses factors it cannot read with 503 and a verified factor with oauth_mfa_account', async () => {
		expect(await harness({ factors: null }).run()).toMatchObject({ status: 503, body: { error: 'oauth_link_unavailable' } });
		const mfa = harness({ factors: [{ id: 'f1', status: 'verified' }] });
		expect(await mfa.run()).toMatchObject({ status: 409, body: { error: 'oauth_mfa_account' } });
		expect(mfa.mutations()).toEqual([]);
	});

	it('lets one of two concurrent links reset and tells the other to retry (C348)', async () => {
		const h = harness();
		const answers = await Promise.all([h.run(), h.run()]);
		expect(answers.filter((a: any) => a.allow)).toHaveLength(1);
		expect(answers.find((a: any) => !a.allow)).toMatchObject({ status: 409, body: { error: 'oauth_link_busy' } });
		expect(h.log.filter((entry) => entry === 'PUT password')).toHaveLength(1);
		expect(h.audits.filter((entry) => entry.event === 'oauth_account_linked')).toHaveLength(1);
	});

	it('refuses with 503 when the lock store is unreachable (C375)', async () => {
		const h = harness();
		h.store.setIfAbsent = async () => {
			throw new Error('redis not connected');
		};
		expect(await h.run()).toMatchObject({ status: 503, body: { error: 'oauth_link_unavailable' } });
		expect(h.mutations()).toEqual([]);
	});
});
