/**
 * POST /api/auth/verify and POST /api/auth/reset-password: the two pages the signed links open.
 *
 * Order of checks (verdict B): the link's own signature and exp (C1, no GoTrue call when it
 * fails) → the password policy (so a weak password never spends a link) → GoTrue /verify.
 * A reset then runs PUT /user, POST /logout?scope=global, the session cut-off the osionos
 * bridge enforces (C8), and the "password changed" notice.
 *
 * A user with a verified TOTP factor is asked for the code and reaches aal2 through GoTrue's
 * challenge/verify before PUT /user (C4). Because /verify has already spent the link by then,
 * the recovery session waits in the store behind a single-use `reset_ticket` the page sends
 * back with the code; the same ticket lets the user retry a password GoTrue rejected.
 * Caveat: the ticket holds GoTrue's aal1 access token in the store (Redis when configured) for
 * up to 10 minutes; anyone who reads the store in that window can finish the reset.
 */
import { createHash, randomBytes } from 'node:crypto';
import { checkLink } from './link-signing.mjs';

const TICKET_TTL_SEC = 600;
const TICKET_ATTEMPTS = 5;

const answer = (status, error, message, extra = {}) => ({ status, body: { error, message, ...extra } });
const ticketKey = (ticket) => `reset-ticket:${createHash('sha256').update(ticket).digest('hex').slice(0, 32)}`;
const attemptsKey = (ticket) => `${ticketKey(ticket)}:attempts`;

function humanMessage(body, fallback) {
	const found = [body?.error_description, body?.msg, body?.message].find((value) => typeof value === 'string' && value.trim());
	return found ? found.trim().slice(0, 240) : fallback;
}

function gotrueRefusal(result) {
	if (result.status === 0 || result.status >= 500) return answer(502, 'auth_unavailable', 'The sign-in service did not answer. Try the same link again in a minute.');
	if (result.status === 429) return answer(429, 'rate_limited', 'Too many attempts. Wait a minute and try again.');
	return answer(410, 'link_used', 'This link was already used or replaced by a newer one. Ask for a new link.');
}

function isInsufficientAal(result) {
	return (result.status === 401 || result.status === 403) && (result.body?.error_code === 'insufficient_aal' || /aal2/i.test(String(result.body?.msg ?? result.body?.message ?? '')));
}

export function createLinkFlows({ gotrue, store, linkKey, nowMs, passwordAcceptable, writeCutoff, notifyPasswordChanged, audit }) {
	function checked(type, fields) {
		const check = checkLink(linkKey, type, fields, Math.floor(nowMs() / 1000));
		if (check.ok) return check;
		audit('auth_link_refused', { type, reason: check.reason });
		if (check.reason === 'unconfigured') return { refusal: answer(503, 'link_signing_unconfigured', 'E-mail links are not configured on this server.') };
		return { refusal: answer(410, check.reason === 'expired' ? 'link_expired' : 'link_invalid', 'This link has expired or is not valid. Ask for a new one.') };
	}

	async function findTotpFactor(userId) {
		const listed = await gotrue.listFactors(userId);
		if (!listed.ok) return 'unknown';
		const factors = Array.isArray(listed.body) ? listed.body : (listed.body.factors ?? []);
		return factors.find((factor) => factor?.factor_type === 'totp' && factor?.status === 'verified') ?? null;
	}

	async function hold(state, ticket, refusal) {
		const kept = ticket ?? randomBytes(24).toString('base64url');
		await store.set(ticketKey(kept), JSON.stringify(state), TICKET_TTL_SEC);
		return { status: refusal.status, body: { ...refusal.body, reset_ticket: kept } };
	}

	async function stepUp(state, code) {
		if (!/^\d{6}$/.test(String(code ?? ''))) return { refusal: answer(401, 'mfa_invalid', 'Enter the 6-digit code from your authenticator app.') };
		const challenge = await gotrue.mfaChallenge(state.accessToken, state.factorId);
		if (!challenge.ok || typeof challenge.body.id !== 'string') return { refusal: gotrueRefusal({ status: challenge.status || 502 }) };
		const verified = await gotrue.mfaVerify(state.accessToken, state.factorId, challenge.body.id, String(code));
		if (verified.status === 0 || verified.status >= 500) return { refusal: gotrueRefusal(verified) };
		if (!verified.ok) return { refusal: answer(401, 'mfa_invalid', 'That code is not valid. Enter the current code from your authenticator app.') };
		return { state: { ...state, accessToken: verified.body.access_token ?? state.accessToken, aal2: true } };
	}

	async function finish(state, ticket) {
		const loggedOut = await gotrue.logout(state.accessToken, 'global');
		if (!loggedOut.ok) audit('password_reset_logout_failed', { user_id: state.userId, status: loggedOut.status });
		const at = new Date(nowMs()).toISOString();
		const cut = (await writeCutoff(state.userId, at)) || (await writeCutoff(state.userId, at));
		if (!cut) audit('password_reset_cutoff_failed', { user_id: state.userId });
		if (ticket) await Promise.all([store.del(ticketKey(ticket)), store.del(attemptsKey(ticket))]);
		if (state.email) notifyPasswordChanged(state.email);
		audit('password_reset_completed', { user_id: state.userId });
		return { status: 200, body: { message: 'Your password was changed. Sign in again with the new password.', signed_out_everywhere: loggedOut.ok && cut } };
	}

	async function refusePassword(state, ticket, updated) {
		if (isInsufficientAal(updated)) {
			const factor = await findTotpFactor(state.userId);
			if (!factor || factor === 'unknown') return answer(502, 'auth_unavailable', 'Your account needs its second factor, and the sign-in service could not provide it.');
			return hold({ ...state, factorId: factor.id }, ticket, answer(401, 'mfa_required', 'Enter the 6-digit code from your authenticator app.'));
		}
		if (updated.status === 400 || updated.status === 422) return hold(state, ticket, answer(422, 'password_rejected', humanMessage(updated.body, 'Choose a different password.')));
		return hold(state, ticket, gotrueRefusal(updated));
	}

	async function proceed(state, password, code, ticket) {
		let current = state;
		if (current.factorId && !current.aal2) {
			if (!code) return hold(current, ticket, answer(401, 'mfa_required', 'Enter the 6-digit code from your authenticator app.'));
			const stepped = await stepUp(current, code);
			if (stepped.refusal) return hold(current, ticket, stepped.refusal);
			current = stepped.state;
		}
		const updated = await gotrue.updatePassword(current.accessToken, password);
		if (!updated.ok) return refusePassword(current, ticket, updated);
		return finish(current, ticket);
	}

	async function continueReset(ticket, password, code) {
		const raw = await store.get(ticketKey(ticket));
		if (!raw) return answer(410, 'reset_ticket_invalid', 'This reset has expired. Ask for a new link.');
		if ((await store.incrWithTtl(attemptsKey(ticket), TICKET_TTL_SEC)) > TICKET_ATTEMPTS) {
			await store.del(ticketKey(ticket));
			return answer(410, 'reset_ticket_invalid', 'Too many attempts. Ask for a new link.');
		}
		if (!passwordAcceptable(password)) return answer(422, 'weak_password', 'Use at least 8 characters with upper and lower case letters, a digit and a symbol.', { reset_ticket: ticket });
		return proceed(JSON.parse(raw), password, code, ticket);
	}

	return {
		async verifyEmail(fields) {
			const check = checked('signup', fields);
			if (check.refusal) return check.refusal;
			const verified = await gotrue.verify('signup', check.tokenHash);
			if (!verified.ok) return gotrueRefusal(verified);
			audit('email_verified', {});
			return { status: 200, body: { message: 'Your email is confirmed. You can sign in now.' } };
		},

		async resetPassword(payload) {
			const password = String(payload?.password ?? '');
			if (payload?.reset_ticket) return continueReset(String(payload.reset_ticket), password, payload.code);
			const check = checked('recovery', { ...payload, type: payload?.type ?? 'recovery' });
			if (check.refusal) return check.refusal;
			if (!passwordAcceptable(password)) return answer(422, 'weak_password', 'Use at least 8 characters with upper and lower case letters, a digit and a symbol.');
			const verified = await gotrue.verify('recovery', check.tokenHash);
			if (!verified.ok) return gotrueRefusal(verified);
			const state = { accessToken: verified.body.access_token, userId: verified.body.user?.id, email: verified.body.user?.email, factorId: null, aal2: false };
			if (typeof state.accessToken !== 'string' || typeof state.userId !== 'string') return answer(502, 'auth_unavailable', 'The sign-in service answered without a session.');
			const factor = await findTotpFactor(state.userId);
			if (factor && factor !== 'unknown') state.factorId = factor.id;
			return proceed(state, password, payload.code, null);
		},
	};
}
