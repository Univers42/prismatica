// @vitest-environment node
import { createClient } from '@grobase/js';
import { describe, expect, it, vi } from 'vitest';

function recorder() {
	const calls: { url: string; method: string }[] = [];
	const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
		calls.push({ url: String(url), method: init?.method ?? 'GET' });
		return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
	});
	return { calls, fetchImpl };
}

// GoTrue routes /user and /admin/users/{id} for PUT only; grobase's own sdks/js uses PUT as well.
describe('vendored @grobase/js user updates', () => {
	it('updates the signed-in user with PUT /auth/v1/user', async () => {
		const { calls, fetchImpl } = recorder();
		const client = createClient({ url: 'http://kong:8000', anonKey: 'anon', persistSession: false, fetch: fetchImpl });
		await client.auth.updateUser({ password: 'New-Pass-1!' }, 'user-token');
		expect(calls).toEqual([{ url: 'http://kong:8000/auth/v1/user', method: 'PUT' }]);
	});

	it('updates an admin-managed user with PUT /auth/v1/admin/users/{id}', async () => {
		const { calls, fetchImpl } = recorder();
		const client = createClient({ url: 'http://kong:8000', anonKey: 'anon', serviceRoleKey: 'service', persistSession: false, fetch: fetchImpl });
		await client.auth.admin.updateUser('u 1', { email_confirm: true });
		expect(calls).toEqual([{ url: 'http://kong:8000/auth/v1/admin/users/u%201', method: 'PUT' }]);
	});
});
