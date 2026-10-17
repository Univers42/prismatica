// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmailApiMailer } from '../../../scripts/auth/email-api-mailer.mjs';

const KEY = 'planted-service-key-DO-NOT-LEAK-0123456789';
const message = { to: 'ines@arlet.test', subject: 'Hello', html: '<p>Hi</p>', text: 'Hi' };

type Answer = number | { status: number; headers?: Record<string, string> } | Error;

function sequence(...answers: Answer[]) {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
		calls.push({ url: String(url), init: init ?? {} });
		const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
		if (answer instanceof Error) throw answer;
		const { status, headers } = typeof answer === 'number' ? { status: answer, headers: {} } : { headers: {}, ...answer };
		return new Response(JSON.stringify(status === 200 ? { messageId: 'm1' } : { error: `echo ${KEY}` }), { status, headers });
	});
	return { calls, fetchImpl };
}

const mailer = (fetchImpl: typeof fetch) => createEmailApiMailer({ baseUrl: 'http://kong:8000/', serviceKey: KEY, fetch: fetchImpl, timeoutMs: 200 });

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('createEmailApiMailer', () => {
	it('POSTs JSON to /email/v1/send with only the apikey header and resolves on 200', async () => {
		const { calls, fetchImpl } = sequence(200);
		await expect(mailer(fetchImpl).send({ ...message, listUnsubscribe: '<https://x.test/u>' })).resolves.toBeUndefined();
		expect(calls[0].url).toBe('http://kong:8000/email/v1/send');
		expect(calls[0].init.method).toBe('POST');
		expect(calls[0].init.headers).toEqual({ apikey: KEY, 'content-type': 'application/json' });
		expect(JSON.parse(String(calls[0].init.body))).toEqual({ ...message, listUnsubscribe: '<https://x.test/u>' });
	});

	it('drops a listUnsubscribe containing CR or LF', async () => {
		const { calls, fetchImpl } = sequence(200);
		await mailer(fetchImpl).send({ ...message, listUnsubscribe: '<a>\r\nBcc: x' });
		expect(JSON.parse(String(calls[0].init.body))).not.toHaveProperty('listUnsubscribe');
	});

	it.each([[400], [403], [502], [500]])('throws a status-only error on %i without retrying', async (status) => {
		const { calls, fetchImpl } = sequence(status);
		await expect(mailer(fetchImpl).send(message)).rejects.toThrow(`email service answered HTTP ${status}`);
		expect(calls).toHaveLength(1);
	});

	it('retries once after a 429 honouring Retry-After, then succeeds', async () => {
		vi.useFakeTimers();
		const { calls, fetchImpl } = sequence({ status: 429, headers: { 'retry-after': '3' } }, 200);
		const pending = mailer(fetchImpl).send(message);
		await vi.advanceTimersByTimeAsync(2_900);
		expect(calls).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(200);
		await expect(pending).resolves.toBeUndefined();
		expect(calls).toHaveLength(2);
	});

	it('caps the Retry-After wait at 10 s and throws after a second 429', async () => {
		vi.useFakeTimers();
		const { calls, fetchImpl } = sequence({ status: 429, headers: { 'retry-after': '3600' } });
		const assertion = expect(mailer(fetchImpl).send(message)).rejects.toThrow('email service answered HTTP 429');
		await vi.advanceTimersByTimeAsync(9_900);
		expect(calls).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(200);
		await assertion;
		expect(calls).toHaveLength(2);
	});

	it('throws on a network failure and on a timeout', async () => {
		const down = sequence(new Error(`connect refused ${KEY}`));
		await expect(mailer(down.fetchImpl).send(message)).rejects.toThrow('email service unreachable');
		const hang = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error(KEY)))));
		await expect(mailer(hang).send(message)).rejects.toThrow('email service unreachable');
	});

	it('never lets the key reach an error message or any console line', async () => {
		const spies = (['log', 'info', 'warn', 'error'] as const).map((name) => vi.spyOn(console, name).mockImplementation(() => undefined));
		const seen: string[] = [];
		for (const answer of [400, 403, 502, new Error(KEY)]) {
			const { fetchImpl } = sequence(answer);
			await mailer(fetchImpl).send(message).catch((error: Error) => seen.push(error.message, String(error.stack), JSON.stringify(error)));
		}
		expect(seen).toHaveLength(12);
		for (const text of [...seen, ...spies.flatMap((spy) => spy.mock.calls.flat().map(String))]) expect(text).not.toContain(KEY);
	});

	it('refuses to send when the key or the base URL is missing', async () => {
		const { calls, fetchImpl } = sequence(200);
		await expect(createEmailApiMailer({ baseUrl: '', serviceKey: KEY, fetch: fetchImpl }).send(message)).rejects.toThrow('not configured');
		await expect(createEmailApiMailer({ baseUrl: 'http://k', serviceKey: '', fetch: fetchImpl }).send(message)).rejects.toThrow('not configured');
		expect(calls).toHaveLength(0);
	});
});
