// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, hits, hitsTo, startFakeKong, startGateway, stopAll, upstream, type Gateway } from './gateway-harness';

const KEY = 'gateway-oauth-start-test-key-0123456789abcdef';
const SITE = 'https://localhost:4322';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

let gateway: Gateway;
let otpGateway: Gateway;
let ipCounter = 0;

beforeAll(async () => {
	await startFakeKong();
	gateway = await startGateway({});
	otpGateway = await startGateway({ AUTH_LOGIN_EMAIL_OTP: 'true', AUTH_LINK_SIGNING_KEY: KEY });
}, 30_000);

afterAll(stopAll);

beforeEach(() => {
	hits.length = 0;
	upstream.settingsStatus = 200;
	upstream.settings = { mailer_autoconfirm: false, external: { google: true, github: true } };
});

// A browser navigation: the redirect is the answer, so it is read, never followed.
async function authorize(target: Gateway, query: string, ip = `10.9.0.${(ipCounter += 1)}`) {
	const response = await fetch(`${target.base}/api/auth/oauth/authorize?${query}`, { redirect: 'manual', headers: { 'x-forwarded-for': ip } });
	return { status: response.status, location: new URL(response.headers.get('location') ?? '', 'http://none') };
}

describe('GET /api/auth/oauth/providers', () => {
	it('lists what GoTrue enables and the origin the callback returns to', async () => {
		const result = await call(gateway, '/api/auth/oauth/providers', { method: 'GET' });
		expect(result.status).toBe(200);
		expect(result.body).toEqual({ providers: ['google', 'github'], origin: SITE });
	});

	it('lists nothing while GoTrue is down', async () => {
		upstream.settingsStatus = 500;
		expect((await call(gateway, '/api/auth/oauth/providers', { method: 'GET' })).body.providers).toEqual([]);
	});
});

describe('GET /api/auth/oauth/authorize', () => {
	it('redirects an enabled provider to GoTrue with the anon key and the PKCE challenge', async () => {
		const result = await authorize(gateway, `provider=github&code_challenge=${CHALLENGE}`);
		expect(result.status).toBe(302);
		expect(`${result.location.origin}${result.location.pathname}`).toBe(`${SITE}/auth/v1/authorize`);
		expect(result.location.searchParams.get('provider')).toBe('github');
		expect(result.location.searchParams.get('apikey')).toBe('anon');
		expect(result.location.searchParams.get('code_challenge')).toBe(CHALLENGE);
		expect(result.location.searchParams.get('redirect_to')).toBe(`${SITE}/auth/callback`);
	});

	it('sends a disabled or unknown provider to the callback page with an error', async () => {
		upstream.settings = { mailer_autoconfirm: false, external: { google: true, github: false } };
		for (const provider of ['github', 'fortytwo', '']) {
			const result = await authorize(gateway, `provider=${provider}&code_challenge=${CHALLENGE}`);
			expect(result.status).toBe(302);
			expect(result.location.href).toBe(`${SITE}/auth/callback?error=oauth_provider_unavailable`);
		}
	});

	it('refuses a malformed challenge and OTP mode before any GoTrue call', async () => {
		for (const query of ['provider=google', 'provider=google&code_challenge=short', `provider=google&code_challenge=${CHALLENGE}%3D`]) {
			const result = await authorize(gateway, query);
			expect(result.location.href).toBe(`${SITE}/auth/callback?error=oauth_invalid_request`);
		}
		const otp = await authorize(otpGateway, `provider=google&code_challenge=${CHALLENGE}`);
		expect(otp.location.href).toBe(`${SITE}/auth/callback?error=oauth_invalid_request`);
		expect(hitsTo('/auth/v1/settings')).toHaveLength(0);
	});

	it('rate limits starts per client IP', async () => {
		let last = await authorize(gateway, `provider=google&code_challenge=${CHALLENGE}`, '10.9.9.9');
		for (let i = 0; i < 30; i += 1) last = await authorize(gateway, `provider=google&code_challenge=${CHALLENGE}`, '10.9.9.9');
		expect(last.location.href).toBe(`${SITE}/auth/callback?error=rate_limited`);
	});
});
