/**
 * The gateway's only mail path: grobase's emailsvc through Kong (`POST ${baseUrl}/email/v1/send`,
 * `apikey: <service role key>`, route acl baas-admin). The gateway holds no SMTP settings;
 * emailsvc owns the transport and always sends from its own EMAIL_FROM (ADR 0006).
 * `send` resolves on 2xx and otherwise throws an Error whose message is a status only: the
 * response body and the cause of a network failure can echo request headers, and the key must
 * not reach a log line (the queue logs error.message).
 *
 * Caveat: Kong rate-limits this route at 10/min and 200/h per client IP, and behind a Funnel
 * every caller shares one IP, hence one bucket. A burst beyond it is retried once (Retry-After,
 * capped at 10 s) and then lost to the caller; the mail queue does not re-enqueue it.
 * `timeoutMs` (8 s) is a guess at "emailsvc is down"; a slower healthy send reads as a failure.
 */

const MAX_RETRY_WAIT_MS = 10_000;

function retryWaitMs(response) {
	const seconds = Number(response.headers.get('retry-after'));
	const wanted = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000;
	return Math.min(wanted, MAX_RETRY_WAIT_MS);
}

function withoutLineBreaks(value) {
	return typeof value === 'string' && value !== '' && !/[\r\n]/.test(value) ? value : undefined;
}

export function createEmailApiMailer({ baseUrl, serviceKey, fetch: fetchImpl = globalThis.fetch, timeoutMs = 8_000 }) {
	const url = `${String(baseUrl ?? '').replace(/\/+$/, '')}/email/v1/send`;

	async function post(body) {
		try {
			return await fetchImpl(url, {
				method: 'POST',
				headers: { apikey: serviceKey, 'content-type': 'application/json' },
				body,
				signal: AbortSignal.timeout(timeoutMs),
			});
		} catch {
			throw new Error('email service unreachable');
		}
	}

	async function send({ to, subject, html, text, listUnsubscribe }) {
		if (!baseUrl || !serviceKey) throw new Error('email service not configured');
		const body = JSON.stringify({ to, subject, html, text, listUnsubscribe: withoutLineBreaks(listUnsubscribe) });
		let response = await post(body);
		if (response.status === 429) {
			await new Promise((done) => setTimeout(done, retryWaitMs(response)));
			response = await post(body);
		}
		if (!response.ok) throw Object.assign(new Error(`email service answered HTTP ${response.status}`), { status: response.status });
	}

	return { send };
}
