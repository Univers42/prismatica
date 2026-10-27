/**
 * Provider sign-in to an account that already exists under the same address
 * (AUTH_OAUTH_LINK_EXISTING, default off).
 *
 * GoTrue links a Google/GitHub identity into the existing account by email. With autoconfirm on,
 * that account may be a /signup row someone created for the address before its owner ever came
 * (F1): the pre-hijacker knows its password. So the link reaches the account only once every
 * credential the provider did not prove is gone, unless the owner already proved the mailbox with
 * a password reset (the `mailbox_proof` marker link-flows writes).
 *
 *   off      the gateway never calls this; a provider sign-in to such an account answers 409.
 *   observe  decides and audits, changes nothing, takes no lock, still 409 (C354, C380).
 *   on       sign out every other session, rotate the password to an unknown value (which
 *            ends the rest), drop unverified factors, re-read the account, cut off osionos
 *            sessions, revoke AI and personal access tokens, mail the owner, write the marker
 *            LAST (C343, C376, C377).
 *            Any failure: 503 and no marker, so the next sign-in resets again.
 *
 * Verdict: osionos-ai-records/oauth-link-newsletter-verdict.md, C341–C355 and C374–C381.
 * Caveat: what the pre-hijacker did inside osionos before the link (workspaces shared, members
 * invited, pages written) survives it; the notice and `workspace_members_to_review` only name
 * it (R1, accepted by the owner before `on`).
 */
import { randomBytes } from 'node:crypto';
import { OAUTH_PROVIDERS } from './oauth-providers.mjs';

const LINK_MODES = ['off', 'observe', 'on'];
const PROOF_SOURCES = ['password_reset', 'oauth_link_reset'];
// The lock outlives the sequence: 25 s of steps plus one 8 s GoTrue timeout in flight (C374).
const LOCK_TTL_SEC = 60;
const DEADLINE_MS = 25_000;

const answer = (status, error, message) => ({ status, body: { error, message } });
const COLLISION = answer(409, 'oauth_email_collision', 'This email is already linked to another sign-in method.');
const MFA_ACCOUNT = answer(409, 'oauth_mfa_account', 'This account uses two-step sign-in. Sign in with your password and code.');
const BUSY = answer(409, 'oauth_link_busy', 'This account is being signed in from another window. Try again in a minute.');
const UNAVAILABLE = answer(503, 'oauth_link_unavailable', 'The sign-in service could not check this account. Try again in a minute.');
const RESET_FAILED = answer(503, 'oauth_link_reset_failed', 'We could not finish securing this account. Try again in a minute.');

class LinkStop extends Error {
	constructor(stage) {
		super(stage);
		this.stage = stage;
	}
}

export function parseLinkMode(value) {
	const mode = String(value ?? '').trim().toLowerCase() || 'off';
	if (!LINK_MODES.includes(mode)) throw new Error(`AUTH_OAUTH_LINK_EXISTING must be one of: ${LINK_MODES.join(', ')}.`);
	return mode;
}

const lower = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

export function markerValid(user) {
	const proof = user?.app_metadata?.mailbox_proof;
	const email = lower(user?.email);
	return PROOF_SOURCES.includes(proof?.by) && email !== '' && lower(proof?.email) === email;
}

function identityProven(identity, email) {
	if (identity?.provider === 'email') return true;
	const data = identity?.identity_data ?? {};
	return OAUTH_PROVIDERS.includes(identity?.provider) && data.email_verified === true && lower(data.email) === email;
}

function refusalReason(user, nowMs) {
	const email = lower(user?.email);
	if (!email || !Array.isArray(user?.identities) || user.identities.length === 0) return 'unreadable';
	if (lower(user.new_email)) return 'pending_email_change';
	if (user.phone || user.new_phone) return 'phone';
	if (user.is_anonymous) return 'anonymous';
	if (user.banned_until && !(Date.parse(user.banned_until) <= nowMs)) return 'banned';
	if (!user.identities.every((identity) => identityProven(identity, email))) return 'unverified_identity';
	return null;
}

/** What a link may do with this account; `factors` is GoTrue's admin list, or null when unreadable. */
export function decide(user, factors, nowMs = Date.now()) {
	if (!Array.isArray(factors)) return { refuse: 'unreadable' };
	const reason = refusalReason(user, nowMs);
	if (reason) return { refuse: reason };
	if (factors.some((factor) => factor?.status === 'verified')) return { mfa: true };
	return { rotate: user.identities.some((identity) => identity.provider === 'email') && !markerValid(user) };
}

export function createOauthLink({ gotrue, store, writeCutoff, notifyLinked, audit, mode, nowMs = Date.now, deadlineMs = DEADLINE_MS, newSecret = () => randomBytes(32).toString('base64url') }) {
	async function readAccount(userId) {
		const [user, factors] = await Promise.all([gotrue.getUser(userId), gotrue.listFactors(userId)]);
		if (!user.ok) return null;
		return { user: user.body, factors: factors.ok && Array.isArray(factors.body) ? factors.body : null };
	}

	const verdictOf = (account) => (account ? decide(account.user, account.factors, nowMs()) : { refuse: 'unreadable' });

	function linked(account, email, details) {
		const providers = [...new Set(account.user.identities.map((identity) => identity.provider))];
		audit('oauth_account_linked', { user_id: account.user.id, email, providers, ...details });
		return { allow: true, credentialReset: details.credential_reset };
	}

	// The answer for every verdict but a needed reset, which returns null.
	function settle(account, email, verdict) {
		if (verdict.refuse) {
			audit('oauth_link_refused', { user_id: account?.user?.id ?? null, email, reason: verdict.refuse });
			return verdict.refuse === 'unreadable' ? UNAVAILABLE : COLLISION;
		}
		if (verdict.mfa) {
			audit('oauth_link_refused', { user_id: account.user.id, email, reason: 'mfa' });
			return MFA_ACCOUNT;
		}
		return verdict.rotate ? null : linked(account, email, { credential_reset: false });
	}

	// C379: read-only, so observe can prove the revoke step would reach both tables before `on`.
	async function probeTokenTables() {
		const [ai, pats] = await Promise.all(['ai_access_tokens', 'osionos_personal_access_tokens'].map((table) => gotrue.serviceRest(`${table}?select=id&limit=1`)));
		return { ai_tokens_status: ai.status, pats_status: pats.status };
	}

	async function observe(userId, email, verdict) {
		const wouldRefuse = verdict.refuse ?? (verdict.mfa ? 'mfa' : null);
		audit('oauth_link_refused', { user_id: userId, email, reason: 'observe', would_reset: verdict.rotate === true, would_refuse_reason: wouldRefuse, ...(await probeTokenTables()) });
		return COLLISION;
	}

	async function revokeTokens(table, userId, fields) {
		const query = `${table}?user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null&select=id`;
		const result = await gotrue.serviceRest(query, { method: 'PATCH', body: fields, prefer: 'return=representation' });
		if (!result.ok || !Array.isArray(result.body)) throw new LinkStop(`revoke_${table}`);
		return result.body.length;
	}

	// Informational (C352): members other than the user in workspaces the user owns; null if unread.
	async function membersToReview(userId) {
		const owned = await gotrue.serviceRest(`osionos_workspace_members?select=workspace_id&role=eq.owner&user_id=eq.${encodeURIComponent(userId)}`);
		if (!owned.ok || !Array.isArray(owned.body)) return null;
		if (owned.body.length === 0) return 0;
		const ids = owned.body.map((row) => encodeURIComponent(String(row.workspace_id))).join(',');
		const others = await gotrue.serviceRest(`osionos_workspace_members?select=user_id&workspace_id=in.(${ids})&user_id=neq.${encodeURIComponent(userId)}`);
		return others.ok && Array.isArray(others.body) ? others.body.length : null;
	}

	async function resetCredentials({ userId, accessToken, email }, factors) {
		const started = nowMs();
		const inTime = () => {
			if (nowMs() - started > deadlineMs) throw new LinkStop('deadline');
		};
		const step = async (stage, run) => {
			inTime();
			if (!(await run()).ok) throw new LinkStop(stage);
		};
		// Logout first: the admin password update ends EVERY session, this provider session included,
		// so a logout after it answers 403 "Session not found" (live 2026-10-27). The rotation then
		// also ends any session minted between the two calls.
		await step('logout', () => gotrue.logout(accessToken, 'others'));
		await step('rotate', () => gotrue.updateUser(userId, { password: newSecret() }));
		// decide() refused every verified factor, so these are all unverified.
		for (const factor of factors) await step('factors', () => gotrue.deleteFactor(userId, factor.id));
		inTime();
		// C377: a pending email change or a factor enrolled meanwhile survives the logout.
		const fresh = await readAccount(userId);
		if (!fresh || fresh.factors?.length !== 0 || refusalReason(fresh.user, nowMs())) throw new LinkStop('account_changed');
		// C376: the cut-off is stamped after the logout returned, so no other session postdates it.
		const at = new Date(nowMs()).toISOString();
		if (!((await writeCutoff(userId, at)) || (await writeCutoff(userId, at)))) throw new LinkStop('cutoff');
		inTime();
		const counts = {
			ai_tokens_revoked: await revokeTokens('ai_access_tokens', userId, { revoked_at: at }),
			// The table's CHECK allows only user/admin; an operator-side revoke is 'admin' (verdict note).
			pats_revoked: await revokeTokens('osionos_personal_access_tokens', userId, { revoked_at: at, revoked_reason: 'admin' }),
			workspace_members_to_review: await membersToReview(userId),
		};
		notifyLinked(email, counts);
		inTime();
		const marked = await gotrue.updateUser(userId, { app_metadata: { mailbox_proof: { at, email, by: 'oauth_link_reset' } } });
		return { ...counts, marker_written: marked.ok };
	}

	async function withLock(userId, run) {
		const key = `oauth-link:${userId}`;
		const owner = newSecret();
		let taken;
		try {
			taken = await store.setIfAbsent(key, owner, LOCK_TTL_SEC);
		} catch {
			return UNAVAILABLE;
		}
		if (!taken) return BUSY;
		try {
			return await run();
		} finally {
			await store.delIfEquals(key, owner).catch(() => undefined);
		}
	}

	async function lockedReset(request) {
		// Re-read under the lock: a reset that finished while this one waited left a valid marker.
		const account = await readAccount(request.userId);
		const settled = settle(account, request.email, verdictOf(account));
		if (settled) return settled;
		try {
			const counts = await resetCredentials(request, account.factors);
			return linked(account, request.email, { credential_reset: true, ...counts });
		} catch (error) {
			audit('oauth_link_reset_failed', { user_id: request.userId, email: request.email, stage: error instanceof LinkStop ? error.stage : 'error' });
			return RESET_FAILED;
		}
	}

	return {
		mode,
		/** `{allow:true, credentialReset}` lets the mint go on; anything else is `{status, body}`. */
		async link(request) {
			if (mode !== 'observe' && mode !== 'on') return COLLISION;
			const account = await readAccount(request.userId);
			const verdict = verdictOf(account);
			if (mode === 'observe') return observe(request.userId, request.email, verdict);
			return settle(account, request.email, verdict) ?? withLock(request.userId, () => lockedReset(request));
		},
	};
}
