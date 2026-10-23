// @vitest-environment node
// public.auth_record_audit_event(event_type, email, details) has no ip parameter
// (models/auth-audit-events-migration.sql), so the gateway carries the derived client IP in details.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, hits, hitsTo, loginBody, startFakeKong, startGateway, stopAll, type Gateway } from './gateway-harness';

let gateway: Gateway;

beforeAll(async () => {
	await startFakeKong();
	gateway = await startGateway({ AUTH_TRUSTED_PROXY_HOPS: '2' });
}, 30_000);

afterAll(stopAll);

describe('audit rows carry the client IP', () => {
	it('records the IP two trusted hops from the right, never a spoofed left entry, with the user agent', async () => {
		hits.length = 0;
		const result = await call(gateway, '/api/auth/login', {
			body: loginBody(),
			headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.7, 10.0.0.1', 'user-agent': 'phone-browser/1.0' },
		});
		expect(result.status).toBe(200);
		const events = hitsTo('/rest/v1/rpc/auth_record_audit_event').map((hit) => JSON.parse(hit.body));
		const success = events.find((event) => event.event_type === 'login_success');
		expect(success.details).toMatchObject({ ip_address: '203.0.113.7', user_agent: 'phone-browser/1.0' });
	});
});
