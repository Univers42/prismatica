// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createSessionCutoffWriter } from '../../../scripts/auth/session-cutoff.mjs';

describe('createSessionCutoffWriter', () => {
	it('upserts public.auth_session_cutoffs through PostgREST with the service key', async () => {
		const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
		const write = createSessionCutoffWriter({ baasUrl: 'http://kong:8000/', serviceKey: 'svc', fetch: fetchImpl });
		expect(await write('user-1', '2026-10-15T12:00:00.123Z')).toBe(true);
		const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('http://kong:8000/rest/v1/auth_session_cutoffs?on_conflict=user_id');
		expect(init.method).toBe('POST');
		expect(init.headers).toMatchObject({ apikey: 'svc', authorization: 'Bearer svc', prefer: 'resolution=merge-duplicates,return=minimal' });
		expect(JSON.parse(String(init.body))).toEqual({ user_id: 'user-1', sessions_valid_after: '2026-10-15T12:00:00.123Z' });
	});

	it('answers false, never throws, on a refusal, a network failure or a missing key', async () => {
		expect(await createSessionCutoffWriter({ baasUrl: 'http://k', serviceKey: 'svc', fetch: vi.fn(async () => new Response('{}', { status: 403 })) })('u', 't')).toBe(false);
		expect(await createSessionCutoffWriter({ baasUrl: 'http://k', serviceKey: 'svc', fetch: vi.fn(async () => { throw new Error('down'); }) })('u', 't')).toBe(false);
		const unused = vi.fn();
		expect(await createSessionCutoffWriter({ baasUrl: 'http://k', serviceKey: '', fetch: unused })('u', 't')).toBe(false);
		expect(unused).not.toHaveBeenCalled();
	});
});
