/**
 * The gateway's only mail path: grobase's emailsvc through Kong (`POST ${baseUrl}/email/v1/send`,
 * `apikey: <service role key>`, route acl baas-admin). The gateway holds no SMTP settings;
 * emailsvc owns the transport and always sends from its own EMAIL_FROM (ADR 0006).
 * `send` resolves on 2xx and otherwise throws an Error whose message is a status only: the
 * response body and the cause of a network failure can echo request headers, and the key must
 * not reach a log line (the queue logs error.message).
 *
 * Caveat: Kong limits this route to 10/min and 200/h per client IP, and the gateway is its one
 * client, so those are ceilings on all the gateway's mail. A 429 is retried once. A sender with a
 * request waiting keeps a 10 s wait, so its retry can land in the same minute and fail. A queued
 * sender passes QUEUED_MAIL and waits out the minute (groot ADR 0048). Still lost, as a failed
 * job and nothing more: anything past the hourly bucket, after holding the worker for that wait;
 * a 429 with no Retry-After, which waits 1 s (unverified through the WAF on the vault42 path);
 * and the newsletter mail inside a queued job, which keeps the 10 s wait.
 * Caveat: the wait has a price. A link is signed before its send, so it can lose 120 s of its life
 * (two timeouts and the wait), and a queued sign-in alert can sit behind a backlog, 9 to 36
 * minutes at a daily cap of 50 to 200. Login approval mail shares the bucket and keeps headroom
 * only while a send takes over 6 s, which holds the one queue worker under 10 a minute; both
 * figures come from a simulation at Titan's 9-13 s of 2026-10-17, not a live stack.
 * An optional `dailyCap` (mail-daily-cap.mjs) refuses the send, as a 429 would, once the day's ceiling is spent.
 * `timeoutMs` (30 s) is a guess at "emailsvc is down". Measured on b2b 2026-10-17: Titan's SMTP
 * exchange makes emailsvc answer "sent" 9-13 s after the request, so a send that times out may
 * still be delivered; the caller sees a failure for a mail that arrives.
 */

const DEFAULT_RETRY_WAIT_MS = 10_000;
export const DEFAULT_MAIL_TIMEOUT_MS = 30_000;
/** For a sender with no request waiting on it: Kong's minute, the longest a window can have left. */
export const QUEUED_MAIL = { maxRetryWaitMs: 60_000 };

/** A positive integer of milliseconds, or the default for anything else (unset, 0, negative, "1e3", "abc"). */
export function resolveMailTimeoutMs(raw) {
	return /^[1-9]\d*$/.test(String(raw ?? '').trim()) ? Number(String(raw).trim()) : DEFAULT_MAIL_TIMEOUT_MS;
}

function retryWaitMs(response, maxRetryWaitMs) {
	const seconds = Number(response.headers.get('retry-after'));
	const wanted = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000;
	return Math.min(wanted, maxRetryWaitMs);
}

function withoutLineBreaks(value) {
	return typeof value === 'string' && value !== '' && !/[\r\n]/.test(value) ? value : undefined;
}

/** @param {{baseUrl: string, serviceKey: string, fetch?: typeof fetch, timeoutMs?: number, dailyCap?: {take: () => Promise<boolean>}}} options */
export function createEmailApiMailer({ baseUrl, serviceKey, fetch: fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_MAIL_TIMEOUT_MS, dailyCap }) {
	const url = `${String(baseUrl ?? '').replace(/\/+$/, '')}/email/v1/send`;

	async function post(body) {
		try {
			return await fetchImpl(url, {
				method: 'POST',
				headers: { apikey: serviceKey, 'content-type': 'application/json' },
				body,
				signal: AbortSignal.timeout(timeoutMs),
			});
		} catch (error) {
			throw new Error(error instanceof Error && error.name === 'TimeoutError' ? 'email service timed out' : 'email service unreachable');
		}
	}

	/**
	 * @param {{to: string, subject: string, html: string, text?: string, listUnsubscribe?: string}} message
	 * @param {{maxRetryWaitMs?: number}} [options] QUEUED_MAIL for a sender no request is waiting on.
	 */
	async function send({ to, subject, html, text, listUnsubscribe }, { maxRetryWaitMs = DEFAULT_RETRY_WAIT_MS } = {}) {
		if (!baseUrl || !serviceKey) throw new Error('email service not configured');
		const body = JSON.stringify({ to, subject, html, text, listUnsubscribe: withoutLineBreaks(listUnsubscribe) });
		// Taken once per message, before the 429 retry, so a retry does not spend a second slot.
		if (dailyCap && !(await dailyCap.take())) throw Object.assign(new Error('email service answered HTTP 429'), { status: 429 });
		let response = await post(body);
		if (response.status === 429) {
			await new Promise((done) => setTimeout(done, retryWaitMs(response, maxRetryWaitMs)));
			response = await post(body);
		}
		if (!response.ok) throw Object.assign(new Error(`email service answered HTTP ${response.status}`), { status: response.status });
	}

	return { send };
}
