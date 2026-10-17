/**
 * The emailed login code that follows a correct password (flag AUTH_LOGIN_EMAIL_OTP).
 *
 * The password grant already created a GoTrue session. It is parked behind a one-time ticket:
 * 256 random bits, handed to the browser only as a cookie, stored here only as its SHA-256. The
 * ticket's record holds the email, the user id and the refresh token encrypted with AES-256-GCM
 * (key: HKDF of the link-signing key, its own info string, so a leak of the store alone is not a
 * session). It never holds an access token. The code is checked by grobase with the TICKET's
 * email, never one a client sent; a wrong code keeps the ticket, an expired or locked code
 * revokes the GoTrue session and deletes it.
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

export const TICKET_COOKIE = 'prismatica_mfa';
export const TICKET_TTL_SEC = 600;
export const MAX_WRONG_CODES = 5;
export const MAX_RESENDS = 3;
const COOKIE_ATTRIBUTES = 'HttpOnly; SameSite=Strict; Secure; Path=/api/auth/mfa';
const CODE = /^\d{6}$/;
const TICKET = /^[A-Za-z0-9_-]{43}$/;
const INFO = 'prismatica-login-ticket-v1';

export function ticketCookie(ticket) {
	return `${TICKET_COOKIE}=${ticket}; ${COOKIE_ATTRIBUTES}; Max-Age=${TICKET_TTL_SEC}`;
}

export function clearTicketCookie() {
	return `${TICKET_COOKIE}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`;
}

/** The ticket from a Cookie header, or '' when absent or not 43 base64url characters. */
export function ticketFrom(cookieHeader) {
	const raw = String(cookieHeader ?? '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${TICKET_COOKIE}=`))?.slice(TICKET_COOKIE.length + 1) ?? '';
	return TICKET.test(raw) ? raw : '';
}

export function isLoginCode(value) {
	return typeof value === 'string' && CODE.test(value);
}

const ticketId = (ticket) => createHash('sha256').update(ticket).digest('hex');

function seal(key, aad, plaintext) {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	cipher.setAAD(Buffer.from(aad));
	const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

function unseal(key, aad, sealed) {
	try {
		const raw = Buffer.from(sealed, 'base64');
		const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
		decipher.setAAD(Buffer.from(aad));
		decipher.setAuthTag(raw.subarray(12, 28));
		return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
	} catch {
		return '';
	}
}

/**
 * @param {{store: object, otp: {request: Function, verify: Function}, sessions: {logout: Function}, gotrue: {refresh: Function}, signingKey: string, resendGapSec?: number, audit: Function}} deps
 */
export function createLoginOtp({ store, otp, sessions, gotrue, signingKey, resendGapSec = 30, audit }) {
	const key = signingKey ? Buffer.from(hkdfSync('sha256', signingKey, '', INFO, 32)) : null;

	async function load(ticket) {
		const id = ticketId(ticket);
		const raw = await store.get(`otp:ticket:${id}`);
		if (raw === null) return null;
		try {
			const record = JSON.parse(raw);
			return { id, email: record.email, userId: record.userId, sealed: record.rt };
		} catch {
			return null;
		}
	}

	async function discard(ticketRecord) {
		const refreshToken = unseal(key, ticketRecord.id, ticketRecord.sealed);
		await store.del(`otp:ticket:${ticketRecord.id}`);
		if (refreshToken) await sessions.logout(refreshToken);
	}

	async function forget(id) {
		await Promise.all([`otp:ticket:${id}`, `otp:wrong:${id}`, `otp:resends:${id}`, `otp:gap:${id}`].map((name) => store.del(name)));
	}

	async function revoke(ticketRecord, auditEvent) {
		await discard(ticketRecord);
		await forget(ticketRecord.id);
		audit(auditEvent, { email: ticketRecord.email });
	}

	async function release(record) {
		const refreshToken = unseal(key, record.id, record.sealed);
		const refreshed = refreshToken ? await gotrue.refresh(refreshToken) : { ok: false };
		await forget(record.id);
		if (!refreshed.ok) return { status: 401, body: { error: 'otp_session_lost', message: 'Sign in again.' }, clearTicket: true };
		audit('login_otp_verified', { email: record.email });
		const { refresh_token: next, ...session } = refreshed.body;
		return { status: 200, body: session, refreshToken: typeof next === 'string' ? next : refreshToken, clearTicket: true, email: record.email };
	}

	return {
		ready: key !== null,

		/**
		 * Park the session behind a ticket and mail the code.
		 * @returns {Promise<{ok: true, ticket: string} | {ok: false, status: 429|503, message: string}>}
		 */
		async begin({ email, userId, refreshToken }) {
			const ticket = randomBytes(32).toString('base64url');
			const id = ticketId(ticket);
			// Caveat: the session lives here, encrypted, for up to TICKET_TTL_SEC; in Redis it survives a
			// gateway restart, in the memory store it does not (the user signs in again, and the
			// orphaned GoTrue session expires with its refresh token).
			await store.set(`otp:ticket:${id}`, JSON.stringify({ email, userId, rt: seal(key, id, refreshToken) }), TICKET_TTL_SEC);
			const outcome = await otp.request(email);
			if (outcome !== 'sent') {
				await sessions.logout(refreshToken);
				await forget(id);
				audit('login_otp_request_failed', { email, outcome });
				return outcome === 'rate_limited'
					? { ok: false, status: 429, message: 'Too many login codes were requested. Wait a few minutes and try again.' }
					: { ok: false, status: 503, message: 'The sign-in code could not be sent. Try again in a moment.' };
			}
			if (resendGapSec > 0) await store.incrWithTtl(`otp:gap:${id}`, resendGapSec);
			audit('login_otp_requested', { email });
			return { ok: true, ticket };
		},

		/** @returns {Promise<{status: number, body: object, session?: object, refreshToken?: string, clearTicket?: boolean, email?: string}>} */
		async verify(ticket, code) {
			const record = ticket ? await load(ticket) : null;
			if (!record) return { status: 401, body: { error: 'otp_ticket_invalid', message: 'Sign in again.' }, clearTicket: true };
			if (!isLoginCode(code)) return { status: 422, body: { error: 'otp_malformed', message: 'Enter the 6-digit code.' } };
			const outcome = await otp.verify(record.email, code);
			if (outcome === 'ok') return release(record);
			if (outcome === 'invalid' && (await store.incrWithTtl(`otp:wrong:${record.id}`, TICKET_TTL_SEC)) < MAX_WRONG_CODES) {
				audit('login_otp_failed', { email: record.email });
				return { status: 401, body: { error: 'otp_invalid', message: 'That code is not right.' } };
			}
			if (outcome === 'expired') {
				await revoke(record, 'login_otp_expired');
				return { status: 410, body: { error: 'otp_expired', message: 'The code expired. Sign in again.' }, clearTicket: true };
			}
			if (outcome === 'unavailable') return { status: 503, body: { error: 'otp_unavailable', message: 'The code could not be checked. Try again.' } };
			await revoke(record, 'login_otp_locked');
			return { status: 429, body: { error: 'otp_locked', message: 'Too many wrong codes. Sign in again.' }, clearTicket: true };
		},

		/** @returns {Promise<{status: number, body: object, retryAfterSec?: number}>} */
		async resend(ticket) {
			const record = ticket ? await load(ticket) : null;
			if (!record) return { status: 401, body: { error: 'otp_ticket_invalid', message: 'Sign in again.' } };
			if (resendGapSec > 0 && (await store.incrWithTtl(`otp:gap:${record.id}`, resendGapSec)) > 1) {
				return { status: 429, body: { error: 'otp_resend_wait', message: 'Wait a moment before asking for another code.' }, retryAfterSec: resendGapSec };
			}
			if ((await store.incrWithTtl(`otp:resends:${record.id}`, TICKET_TTL_SEC)) > MAX_RESENDS) {
				return { status: 429, body: { error: 'otp_resend_limit', message: 'No more codes can be sent for this sign-in. Sign in again.' } };
			}
			const outcome = await otp.request(record.email);
			if (outcome === 'sent') {
				audit('login_otp_requested', { email: record.email });
				return { status: 200, body: { sent: true } };
			}
			audit('login_otp_request_failed', { email: record.email, outcome });
			return outcome === 'rate_limited'
				? { status: 429, body: { error: 'otp_resend_limit', message: 'Too many login codes were requested. Wait a few minutes.' } }
				: { status: 503, body: { error: 'otp_send_failed', message: 'The code could not be sent. Try again in a moment.' } };
		},
	};
}
