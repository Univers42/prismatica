// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createGotrueApi } from '../../../scripts/auth/gotrue-api.mjs';

function recorder(status = 200, body: unknown = { ok: true }) {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
		calls.push({ url: String(url), init: init ?? {} });
		return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
	});
	return { calls, fetchImpl };
}

const base = { baseUrl: 'http://kong:8000/', anonKey: 'anon', serviceKey: 'service' };

describe('createGotrueApi', () => {
	it('verifies a token_hash server-side with the anon key', async () => {
		const { calls, fetchImpl } = recorder(200, { access_token: 'at' });
		const result = await createGotrueApi({ ...base, fetch: fetchImpl }).verify('recovery', 'hash');
		expect(result).toEqual({ ok: true, status: 200, body: { access_token: 'at' } });
		expect(calls[0].url).toBe('http://kong:8000/auth/v1/verify');
		expect(calls[0].init.method).toBe('POST');
		expect(JSON.parse(String(calls[0].init.body))).toEqual({ type: 'recovery', token_hash: 'hash' });
		expect(calls[0].init.headers).toMatchObject({ apikey: 'anon', authorization: 'Bearer anon' });
	});

	it('updates the password with PUT /user and the user token, and signs out with the asked scope', async () => {
		const { calls, fetchImpl } = recorder();
		const gotrue = createGotrueApi({ ...base, fetch: fetchImpl });
		await gotrue.updatePassword('user-at', 'New-Pass-1!');
		await gotrue.logout('user-at', 'global');
		expect(calls[0].url).toBe('http://kong:8000/auth/v1/user');
		expect(calls[0].init.method).toBe('PUT');
		expect(calls[0].init.headers).toMatchObject({ apikey: 'anon', authorization: 'Bearer user-at' });
		expect(calls[1].url).toBe('http://kong:8000/auth/v1/logout?scope=global');
	});

	it('calls admin routes with the service key only', async () => {
		const { calls, fetchImpl } = recorder(200, [{ id: 'f1' }]);
		const gotrue = createGotrueApi({ ...base, fetch: fetchImpl });
		await gotrue.generateLink({ type: 'recovery', email: 'a@b.test' });
		await gotrue.listFactors('user/1');
		expect(calls[0].url).toBe('http://kong:8000/auth/v1/admin/generate_link');
		expect(calls[0].init.headers).toMatchObject({ apikey: 'service', authorization: 'Bearer service' });
		expect(calls[1].url).toBe('http://kong:8000/auth/v1/admin/users/user%2F1/factors');
		expect(calls[1].init.method).toBe('GET');
	});

	it('reads, updates and removes a factor of a user through the admin routes', async () => {
		const { calls, fetchImpl } = recorder();
		const gotrue = createGotrueApi({ ...base, fetch: fetchImpl });
		await gotrue.getUser('u1');
		await gotrue.updateUser('u1', { app_metadata: { a: 1 } });
		await gotrue.deleteFactor('u1', 'f/1');
		expect(calls.map((call) => `${call.init.method} ${call.url}`)).toEqual([
			'GET http://kong:8000/auth/v1/admin/users/u1',
			'PUT http://kong:8000/auth/v1/admin/users/u1',
			'DELETE http://kong:8000/auth/v1/admin/users/u1/factors/f%2F1',
		]);
		expect(JSON.parse(String(calls[1].init.body))).toEqual({ app_metadata: { a: 1 } });
		for (const call of calls) expect(call.init.headers).toMatchObject({ apikey: 'service', authorization: 'Bearer service' });
	});

	it('reaches PostgREST with the service key and the asked Prefer header', async () => {
		const { calls, fetchImpl } = recorder(200, [{ id: 't1' }]);
		const result = await createGotrueApi({ ...base, fetch: fetchImpl }).serviceRest('ai_access_tokens?user_id=eq.u1&select=id', { method: 'PATCH', body: { revoked_at: 'now' }, prefer: 'return=representation' });
		expect(result.body).toEqual([{ id: 't1' }]);
		expect(calls[0].url).toBe('http://kong:8000/rest/v1/ai_access_tokens?user_id=eq.u1&select=id');
		expect(calls[0].init.method).toBe('PATCH');
		expect(calls[0].init.headers).toMatchObject({ apikey: 'service', authorization: 'Bearer service', prefer: 'return=representation' });
	});

	it('runs the TOTP challenge and verify with the user token', async () => {
		const { calls, fetchImpl } = recorder(200, { id: 'ch1' });
		const gotrue = createGotrueApi({ ...base, fetch: fetchImpl });
		await gotrue.mfaChallenge('at', 'f1');
		await gotrue.mfaVerify('at', 'f1', 'ch1', '123456');
		expect(calls[0].url).toBe('http://kong:8000/auth/v1/factors/f1/challenge');
		expect(calls[1].url).toBe('http://kong:8000/auth/v1/factors/f1/verify');
		expect(JSON.parse(String(calls[1].init.body))).toEqual({ challenge_id: 'ch1', code: '123456' });
	});

	it('answers {ok:false,status:0} instead of throwing when the network or the body fails', async () => {
		const down = createGotrueApi({ ...base, fetch: vi.fn(async () => { throw new Error('ECONNREFUSED'); }) });
		await expect(down.verify('signup', 'h')).resolves.toEqual({ ok: false, status: 0, body: {} });
		const garbled = createGotrueApi({ ...base, fetch: vi.fn(async () => new Response('<html>', { status: 502 })) });
		await expect(garbled.refresh('rt')).resolves.toEqual({ ok: false, status: 502, body: {} });
	});

	it('refuses an admin call when no service key is configured, without a request', async () => {
		const { calls, fetchImpl } = recorder();
		const result = await createGotrueApi({ ...base, serviceKey: '', fetch: fetchImpl }).generateLink({});
		expect(result.ok).toBe(false);
		expect(calls).toHaveLength(0);
	});
});
