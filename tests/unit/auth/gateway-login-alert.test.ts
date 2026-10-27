// @vitest-environment node
// The real gateway behind two proxy hops: a successful sign-in alerts once per (address, client
// IP, user agent) a day; a new IP or browser still alerts, and a failed send suppresses nothing.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, hits, hitsTo, loginBody, startFakeKong, startGateway, stopAll, upstream, type Gateway } from './gateway-harness';

const settle = () => new Promise((done) => setTimeout(done, 500));
const mailsTo = (address: string) => hitsTo('/email/v1/send').filter((hit) => JSON.parse(hit.body).to === address).length;
const suppressed = (address: string) =>
	hits.filter((hit) => hit.path.includes('auth_record_audit_event') && hit.body.includes('"login_alert_suppressed"') && hit.body.includes(address)).length;
const PROXY = '10.20.0.2';

let gateway: Gateway;

beforeAll(async () => {
	await startFakeKong();
	gateway = await startGateway({ AUTH_EMAIL_DOMAIN_ALLOWLIST: 'arlet.test', AUTH_TRUSTED_PROXY_HOPS: '2' });
}, 30_000);

afterAll(stopAll);

beforeEach(() => {
	hits.length = 0;
	upstream.passwordStatus = 200;
	upstream.mailStatus = 200;
});

const signIn = async (email: string, client: string, userAgent = 'Firefox/140') => {
	upstream.existingEmails = [email];
	const result = await call(gateway, '/api/auth/login', { body: loginBody(email), headers: { 'x-forwarded-for': `${client}, ${PROXY}`, 'user-agent': userAgent } });
	expect(result.status).toBe(200);
	await settle();
};

describe('successful sign-in alert', () => {
	it('mails once for repeated sign-ins from one client, and again from a new IP behind the same proxy', async () => {
		const email = 'repeat@arlet.test';
		await signIn(email, '203.0.113.7');
		await signIn(email, '203.0.113.7');
		expect(mailsTo(email)).toBe(1);
		expect(suppressed(email)).toBe(1);
		await signIn(email, '198.51.100.9');
		expect(mailsTo(email)).toBe(2);
	});

	it('mails again for a new browser on the same IP', async () => {
		const email = 'browser@arlet.test';
		await signIn(email, '203.0.113.8', 'Firefox/140');
		await signIn(email, '203.0.113.8', 'Chrome/141');
		expect(mailsTo(email)).toBe(2);
	});

	it('does not suppress the next alert when the mail service refused the first', async () => {
		const email = 'refused@arlet.test';
		upstream.mailStatus = 503;
		await signIn(email, '203.0.113.9');
		upstream.mailStatus = 200;
		hits.length = 0;
		await signIn(email, '203.0.113.9');
		expect(mailsTo(email)).toBe(1);
		expect(suppressed(email)).toBe(0);
	});
});
