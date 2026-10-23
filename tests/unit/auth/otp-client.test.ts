import { describe, expect, it, vi } from 'vitest';
import { createOtpClient } from '../../../scripts/auth/otp-client.mjs';

const proof = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const client = (fetchImpl: any) => createOtpClient({ baseUrl: 'http://kong:8000/', serviceKey: 'SVC-KEY', fetch: fetchImpl });

describe('otp client request', () => {
	it('posts the email with the service key as the only credential', async () => {
		const fetchImpl = vi.fn(async () => reply(200, { sent: true }));
		expect(await client(fetchImpl).request('a@b.test')).toBe('sent');
		const [url, init] = fetchImpl.mock.calls[0] as any;
		expect(url).toBe('http://kong:8000/v1/auth/otp/request');
		expect(init.headers).toEqual({ 'content-type': 'application/json', apikey: 'SVC-KEY' });
		expect(init.body).toBe('{"email":"a@b.test"}');
	});

	it.each([[200, 'sent'], [429, 'rate_limited'], [502, 'send_failed'], [500, 'unavailable'], [401, 'unavailable'], [400, 'unavailable']])('maps HTTP %i to %s', async (status, outcome) => {
		expect(await client(async () => reply(status)).request('a@b.test')).toBe(outcome);
	});

	it('reads a network failure as unavailable and never throws', async () => {
		expect(await client(async () => { throw new Error('boom SVC-KEY'); }).request('a@b.test')).toBe('unavailable');
	});

	it('is unavailable without a service key or base url, calling nothing', async () => {
		const fetchImpl = vi.fn();
		expect(await createOtpClient({ baseUrl: 'http://kong', serviceKey: '', fetch: fetchImpl }).request('a@b.test')).toBe('unavailable');
		expect(await createOtpClient({ baseUrl: '', serviceKey: 'k', fetch: fetchImpl }).request('a@b.test')).toBe('unavailable');
		expect(fetchImpl).not.toHaveBeenCalled();
	});
});

describe('otp client verify', () => {
	const good = { otp: 'a@b.test', aud: 'otp-proof' };

	it('posts email and code with no credential header', async () => {
		const fetchImpl = vi.fn(async () => reply(200, { verified: true, proof: proof(good) }));
		expect(await client(fetchImpl).verify('a@b.test', '123456')).toBe('ok');
		const [url, init] = fetchImpl.mock.calls[0] as any;
		expect(url).toBe('http://kong:8000/v1/auth/otp/verify');
		expect(init.headers).toEqual({ 'content-type': 'application/json' });
		expect(init.body).toBe('{"email":"a@b.test","code":"123456"}');
	});

	it.each([[401, 'invalid'], [410, 'expired'], [429, 'locked'], [500, 'unavailable'], [404, 'unavailable']])('maps HTTP %i to %s', async (status, outcome) => {
		expect(await client(async () => reply(status)).verify('a@b.test', '123456')).toBe(outcome);
	});

	it('compares the proof email case-insensitively with the asked email', async () => {
		expect(await client(async () => reply(200, { verified: true, proof: proof(good) })).verify('A@B.test', '1')).toBe('ok');
	});

	it.each([
		['another email in the proof', { verified: true, proof: proof({ otp: 'x@y.test', aud: 'otp-proof' }) }],
		['a wrong audience', { verified: true, proof: proof({ otp: 'a@b.test', aud: 'other' }) }],
		['no proof', { verified: true }],
		['an undecodable proof', { verified: true, proof: 'garbage' }],
		['verified false', { verified: false, proof: proof(good) }],
	])('fails a 200 with %s as mismatch', async (_name, body) => {
		expect(await client(async () => reply(200, body)).verify('a@b.test', '123456')).toBe('mismatch');
	});

	it('reads a network failure as unavailable', async () => {
		expect(await client(async () => { throw new Error('down'); }).verify('a@b.test', '123456')).toBe('unavailable');
	});
});
