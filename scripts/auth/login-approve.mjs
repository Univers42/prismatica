/**
 * "Yes, it's me": approving a sign-in from another device (flag AUTH_LOGIN_APPROVE_LINK, only
 * meaningful with AUTH_LOGIN_EMAIL_OTP). Rides on the login ticket: after the password the gateway
 * mails ONE message with an Approve link instead of a code; the waiting browser shows a 2-digit
 * number, the approver types it on the link page, and the waiting browser's next status poll
 * releases the session exactly as a correct code would.
 *
 * The approval token (32 random bytes) is only in the mail; the store keeps sha256(token) -> ticket
 * id. The ticket id and the number are never mailed, and the approving device receives no session,
 * cookie or token: it can only say yes (with the number), or no.
 *
 * Caveat: number matching and codes alike fall to a real-time phishing proxy that relays both
 * screens; only WebAuthn stops that (docs/login-approval.md). The 2-digit number is 1 in 90, which
 * is why a wrong number revokes the ticket at once and each token gets one attempt.
 */
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { keyHash } from './identity.mjs';
import { TICKET_TTL_SEC, ticketId } from './login-otp.mjs';

export const POLL_GAP_SEC = 2;
export const MAIL_CAPS = Object.freeze([
	{ label: '15m', windowSec: 900, max: 3 },
	{ label: '1h', windowSec: 3600, max: 6 },
]);
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const NUMBER = /^\d{2}$/;
const GONE = { status: 410, body: { error: 'approve_gone', message: 'This sign-in request is no longer valid.' } };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/**
 * At most 3 sign-in mails per account per 15 minutes and 6 per hour, approval mails and code resends together.
 * Caveat: fixed windows, not sliding (a burst can straddle a boundary and send up to twice the cap),
 * and a mail that fails to send still counts. A refused ask does not spend the hourly budget.
 * @returns {(email: string) => Promise<boolean>}
 */
export function createSignInMailCap({ store }) {
	return async (email) => {
		for (const { label, windowSec, max } of MAIL_CAPS) {
			if ((await store.incrWithTtl(`otp:mailcap:${label}:${keyHash(email)}`, windowSec)) > max) return false;
		}
		return true;
	};
}

/**
 * @param {{otp: object, store: object, sessions: {logout: Function}, mail: {send: Function, render: Function}, siteUrl: string, mailCap: Function, lockLogin: (email: string) => Promise<void>, audit: Function}} deps
 */
export function createLoginApprove({ otp, store, sessions, mail, siteUrl, mailCap, lockLogin, audit }) {
	const tokenKey = (hash) => `otp:approve:${hash}`;

	// The token resolves to a live ticket or to nothing; the lookup is the check, there is no signature.
	async function resolve(token) {
		const hash = sha256(token);
		const id = await store.get(tokenKey(hash));
		const record = id === null ? null : await otp.findById(id);
		return record ? { hash, record } : null;
	}

	// One attempt per token, claimed before any state changes so two concurrent posts cannot both act.
	async function claim(hash, id) {
		const remainingMs = await store.pttl(`otp:ticket:${id}`);
		const ttl = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : TICKET_TTL_SEC;
		return (await store.incrWithTtl(`otp:approve-used:${hash}`, ttl)) === 1;
	}

	async function sendApprovalMail(email, token, summary) {
		const message = mail.render('approveSignIn', {
			email,
			approveUrl: `${siteUrl}/auth/approve#t=${token}`,
			siteUrl,
			expiresIn: `${TICKET_TTL_SEC / 60} minutes`,
			...summary,
		});
		await mail.send({ to: email, ...message });
	}

	return {
		/**
		 * Park the session and send the single approval mail.
		 * @param {{email: string, userId: string, refreshToken: string, summary: object, ip: string}} login
		 * @returns {Promise<{ok: true, ticket: string, match: number} | {ok: false, status: 429|503, message: string}>}
		 */
		async begin({ email, userId, refreshToken, summary, ip }) {
			if (!(await mailCap(email))) {
				await sessions.logout(refreshToken);
				audit('login_approve_capped', { email, ip, via: 'login' });
				return { ok: false, status: 429, message: 'Too many login codes were requested. Wait a few minutes and try again.' };
			}
			const match = randomInt(10, 100);
			const { ticket, id } = await otp.park({ email, userId, refreshToken, extra: { match, summary } });
			const token = randomBytes(32).toString('base64url');
			const key = tokenKey(sha256(token));
			await store.set(key, id, TICKET_TTL_SEC);
			try {
				await sendApprovalMail(email, token, summary);
			} catch (error) {
				await store.del(key);
				await otp.revoke(await otp.findById(id), 'login_approve_send_failed', { ip, error: error instanceof Error ? error.message : 'unknown_error' });
				return { ok: false, status: 503, message: 'The sign-in request could not be sent. Try again in a moment.' };
			}
			audit('login_approve_requested', { email, ip });
			return { ok: true, ticket, match };
		},

		/** The request the approver is asked to confirm; a POST so a mail scanner's GET reads nothing. */
		async summary(token) {
			if (typeof token !== 'string' || !TOKEN.test(token)) return { status: 422, body: { error: 'approve_malformed', message: 'This link is incomplete.' } };
			const found = await resolve(token);
			if (!found) return GONE;
			const remainingMs = await store.pttl(`otp:ticket:${found.record.id}`);
			return { status: 200, body: { summary: found.record.summary ?? {}, expiresInSec: Math.max(0, Math.ceil(remainingMs / 1000)) } };
		},

		/** Right number: the ticket is marked approved. Wrong number: the session is revoked (409). */
		async approve({ token, match, ip }) {
			if (typeof token !== 'string' || !TOKEN.test(token) || typeof match !== 'string' || !NUMBER.test(match)) {
				return { status: 422, body: { error: 'approve_malformed', message: 'Enter the 2-digit number shown on the other screen.' } };
			}
			const found = await resolve(token);
			if (!found || !(await claim(found.hash, found.record.id))) return GONE;
			await store.del(tokenKey(found.hash));
			if (match !== String(found.record.match)) {
				await otp.revoke(found.record, 'login_approve_mismatch', { ip });
				return { status: 409, body: { error: 'approve_mismatch', message: 'That is not the number on the other screen. The sign-in was cancelled.' } };
			}
			await store.set(`otp:approved:${found.record.id}`, '1', TICKET_TTL_SEC);
			audit('login_approve_approved', { email: found.record.email, ip });
			return { status: 200, body: { approved: true } };
		},

		/** "It wasn't me": revoke, and lock the account's password login. */
		async deny({ token, ip }) {
			if (typeof token !== 'string' || !TOKEN.test(token)) return { status: 422, body: { error: 'approve_malformed', message: 'This link is incomplete.' } };
			const found = await resolve(token);
			if (!found || !(await claim(found.hash, found.record.id))) return GONE;
			await store.del(tokenKey(found.hash));
			await otp.revoke(found.record, 'login_approve_denied', { ip });
			await lockLogin(found.record.email);
			return { status: 200, body: { denied: true } };
		},

		/**
		 * The waiting browser's poll (ticket cookie). Approved: the same release as a correct code.
		 * Caveat: one poll per POLL_GAP_SEC per ticket; a client faster than that gets 429 and must wait.
		 */
		async status(ticket, ip) {
			if (!ticket) return { status: 401, body: { error: 'otp_ticket_invalid', message: 'Sign in again.' } };
			const id = ticketId(ticket);
			if ((await store.incrWithTtl(`otp:poll:${id}`, POLL_GAP_SEC)) > 1) {
				return { status: 429, body: { error: 'poll_too_fast', message: 'Wait a moment.' }, retryAfterSec: POLL_GAP_SEC };
			}
			const record = await otp.findById(id);
			if (!record) return { ...GONE, clearTicket: true };
			if ((await store.get(`otp:approved:${id}`)) === null) return { status: 202, body: { pending: true } };
			const released = await otp.release(record);
			if (released.status === 200) audit('login_approve_released', { email: record.email, ip });
			return released;
		},
	};
}
