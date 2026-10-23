// @vitest-environment node
// The real gateway with AUTH_VERIFICATION_EXEMPT: no gateway mail to a listed address from any
// sender, one audit per suppression, register answered like a taken address, and the boot guard.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boot, call, hits, hitsTo, KEY, loginBody, ROOT, startFakeKong, startGateway, stopAll, upstream, type Gateway } from './gateway-harness';

const EXEMPT = 'dylan@gmail.com';
const OTHER = 'ines@arlet.test';
const DOMAINS = 'arlet.test,gmail.com';
const settle = () => new Promise((done) => setTimeout(done, 500));
const mailsTo = (address: string) => hitsTo('/email/v1/send').filter((hit) => JSON.parse(hit.body).to === address).length;
const audits = (event: string, address: string) =>
	hits.filter((hit) => hit.path.includes('auth_record_audit_event') && hit.body.includes(`"${event}"`) && hit.body.includes(address)).length;
const generateLinks = () => hitsTo('/auth/v1/admin/generate_link').length;

let gateway: Gateway;
let listed: Gateway;

beforeAll(async () => {
	await startFakeKong();
	gateway = await startGateway({ AUTH_VERIFICATION_EXEMPT: EXEMPT, AUTH_EMAIL_DOMAIN_ALLOWLIST: DOMAINS });
	listed = await startGateway({ AUTH_VERIFICATION_EXEMPT: EXEMPT, AUTH_EMAIL_DOMAIN_ALLOWLIST: DOMAINS, AUTH_SIGNUP_ALLOWLIST: `${EXEMPT},news@arlet.test` });
}, 30_000);

afterAll(stopAll);

beforeEach(() => {
	hits.length = 0;
	upstream.passwordStatus = 200;
	upstream.existingEmails = [];
});

const turnstile = { turnstileToken: 'localhost-turnstile-token' };

describe.each([
	['login success alert', 200, 'login_alert_sent'],
	['login failed alert', 401, 'login_alert_sent'],
])('%s', (label, status, sentEvent) => {
	const attempt = async (email: string) => {
		upstream.passwordStatus = status === 200 ? 200 : 400;
		upstream.existingEmails = [EXEMPT, OTHER];
		hits.length = 0;
		const result = await call(gateway, '/api/auth/login', { body: loginBody(email) });
		await settle();
		return result;
	};

	it('mails an exempt recipient nothing and audits the suppression once', async () => {
		expect((await attempt(EXEMPT)).status).toBe(status);
		expect(mailsTo(EXEMPT)).toBe(0);
		expect(audits('mail_suppressed_exempt', EXEMPT)).toBe(1);
		expect(audits(sentEvent, EXEMPT), label).toBe(0);
	});

	it('still mails a non-exempt recipient through the same flow', async () => {
		expect((await attempt(OTHER)).status).toBe(status);
		expect(mailsTo(OTHER)).toBe(1);
		expect(audits('mail_suppressed_exempt', OTHER)).toBe(0);
	});
});

describe.each([
	['verification resend', '/api/auth/resend-verification', 'resend@arlet.test'],
	['password recovery', '/api/auth/recover', 'recover@arlet.test'],
])('%s', (_label, route, other) => {
	// The per-address mail allowance (3 an hour) is shared by every account-mail kind, so each row has its own control address.
	const request = async (email: string) => {
		upstream.existingEmails = [EXEMPT, other];
		const result = await call(gateway, route, { body: { email, ...turnstile } });
		await settle();
		return result;
	};

	it('mails an exempt recipient nothing, audits the suppression once, and answers as for anyone', async () => {
		const exempt = await request(EXEMPT);
		expect(generateLinks()).toBe(1);
		expect(mailsTo(EXEMPT)).toBe(0);
		expect(audits('mail_suppressed_exempt', EXEMPT)).toBe(1);
		expect((await request(other)).text).toBe(exempt.text);
	});

	it('still mails a non-exempt recipient through the same flow', async () => {
		await request(other);
		expect(mailsTo(other)).toBe(1);
	});
});

describe('POST /api/auth/register with an exempt address', () => {
	const register = (email: string, username: string) =>
		call(gateway, '/api/auth/register', { body: { email, password: 'Right-Pass-1!', ...turnstile, profile: { username, confirmPassword: 'Right-Pass-1!', emailVerificationConsent: true } } });

	it('answers byte-identically to a taken address, with no link requested and no mail', async () => {
		upstream.existingEmails = ['taken@arlet.test'];
		const taken = await register('taken@arlet.test', 'taken_user');
		await settle();
		expect(taken.status).toBe(202);
		expect(mailsTo('taken@arlet.test')).toBe(1);
		hits.length = 0;
		const exempt = await register(EXEMPT, 'exempt_user');
		await settle();
		expect(exempt.status).toBe(202);
		expect(exempt.text).toBe(taken.text);
		expect(generateLinks()).toBe(0);
		expect(hitsTo('/email/v1/send')).toHaveLength(0);
		expect(audits('signup_refused_exempt', EXEMPT)).toBe(1);
	});

	it('does not wait for the audit write, so its latency is not a way to read the list', async () => {
		upstream.auditDelayMs = 600;
		try {
			const started = Date.now();
			const exempt = await register(EXEMPT, 'exempt_slow');
			expect(exempt.status).toBe(202);
			expect(Date.now() - started).toBeLessThan(300);
			await settle();
			await new Promise((done) => setTimeout(done, 300));
			expect(audits('signup_refused_exempt', EXEMPT)).toBe(1);
		} finally {
			upstream.auditDelayMs = 0;
		}
	});

	it('still lets a fresh non-exempt address through to a link and a mail', async () => {
		expect((await register('fresh@arlet.test', 'fresh_user')).status).toBe(202);
		await settle();
		expect(generateLinks()).toBe(1);
		expect(mailsTo('fresh@arlet.test')).toBe(1);
	});
});

describe('POST /api/newsletter/subscribe', () => {
	const subscribe = async (email: string) => {
		const result = await call(listed, '/api/newsletter/subscribe', { body: { email, ...turnstile } });
		await settle();
		return result;
	};

	it('mails an exempt subscriber nothing and does not audit a confirmation as sent', async () => {
		expect((await subscribe(EXEMPT)).status).toBe(200);
		expect(mailsTo(EXEMPT)).toBe(0);
		expect(audits('mail_suppressed_exempt', EXEMPT)).toBe(1);
		expect(audits('newsletter_confirmation_email_sent', EXEMPT)).toBe(0);
	});

	it('still mails and audits a listed non-exempt subscriber', async () => {
		expect((await subscribe('news@arlet.test')).status).toBe(200);
		expect(mailsTo('news@arlet.test')).toBe(1);
		expect(audits('newsletter_confirmation_email_sent', 'news@arlet.test')).toBe(1);
	});
});

describe('the one suppression point', () => {
	const source = readFileSync(`${ROOT}/scripts/auth-gateway.mjs`, 'utf8');

	it('has every gateway mail go through sendMail: the raw mailer is called in one place', () => {
		expect(source.match(/emailMailer\.send\(/g)).toHaveLength(1);
		expect(source).toContain('mailer: { send: sendMail }');
		expect(source).toContain('mail: { send: sendMail,');
	});
});

describe('boot', () => {
	it('starts with a valid list', async () => {
		expect((await boot({ SERVICE_ROLE_KEY: 'service', AUTH_VERIFICATION_EXEMPT: `${EXEMPT} ines@arlet.test` })).output).toContain('Auth gateway listening');
	}, 15_000);

	it.each([
		['a domain entry', { AUTH_VERIFICATION_EXEMPT: '@gmail.com' }],
		['a wildcard', { AUTH_VERIFICATION_EXEMPT: '*@gmail.com' }],
		['a quoted local part', { AUTH_VERIFICATION_EXEMPT: '"dylan"@gmail.com' }],
		['an invalid address', { AUTH_VERIFICATION_EXEMPT: 'dylan' }],
		['eleven entries', { AUTH_VERIFICATION_EXEMPT: Array.from({ length: 11 }, (_, n) => `u${n}@arlet.test`).join(',') }],
		['the emailed sign-in code', { AUTH_VERIFICATION_EXEMPT: EXEMPT, AUTH_LOGIN_EMAIL_OTP: 'true', AUTH_LINK_SIGNING_KEY: KEY }],
	])('refuses %s on a local origin, naming AUTH_VERIFICATION_EXEMPT', async (_label, env) => {
		const result = await boot({ SERVICE_ROLE_KEY: 'service', ...env });
		expect(result.code).toBe(1);
		expect(result.output).toContain('AUTH_VERIFICATION_EXEMPT');
	}, 15_000);
});
