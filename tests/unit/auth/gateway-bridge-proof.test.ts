// @vitest-environment node
// The real scripts/auth-gateway.mjs with a Turnstile secret and the bridge's shared secret (#50):
// a sign-in the osionos bridge already verified carries a proof instead of a second siteverify of
// a spent token; anything else must pass Turnstile. Conditions from the 2026-11-03 devil verdict.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signBridgeProof } from '../../../scripts/auth/bridge-proof.mjs';
import { call, loginBody, startFakeKong, startGateway, stopAll, type Gateway } from './gateway-harness';

const BRIDGE_SECRET = 'bridge-shared-secret-for-tests-0123456789';
const strict = { TURNSTILE_BYPASS_LOCAL: 'false', TURNSTILE_SECRET_KEY: 'secret' };
let gateway: Gateway;
let noBridgeSecret: Gateway;

beforeAll(async () => {
	await startFakeKong();
	gateway = await startGateway({ ...strict, OSIONOS_BRIDGE_SHARED_SECRET: BRIDGE_SECRET });
	noBridgeSecret = await startGateway(strict);
}, 30_000);

afterAll(stopAll);

const now = () => Math.floor(Date.now() / 1000);
// A fresh token per attempt, as the bridge forwards one Cloudflare token per sign-in.
let attempt = 0;
const attemptBody = () => ({ ...loginBody(), turnstileToken: `token-${(attempt += 1)}` });
const login = (body: object, proof?: string, target: Gateway = gateway, path = '/api/auth/login') =>
	call(target, path, { body, headers: proof ? { 'x-osionos-bridge-proof': proof } : {} });

describe('a bridge proof on /api/auth/login', () => {
	it('signs the user in without a second Turnstile check', async () => {
		const body = attemptBody();
		const result = await login(body, signBridgeProof(BRIDGE_SECRET, '/api/auth/login', body));
		expect(result.status).toBe(200);
		expect(result.body.access_token).toBe('at-0');
	});

	it('is accepted once: the same proof replayed is refused', async () => {
		const body = attemptBody();
		const proof = signBridgeProof(BRIDGE_SECRET, '/api/auth/login', body);
		expect((await login(body, proof)).status).toBe(200);
		expect((await login(body, proof)).status).toBe(403);
	});

	it('refuses a proof for another body, another path, another secret, or outside the window', async () => {
		const body = attemptBody();
		const refused = [
			login({ ...body, password: 'Other-Pass-1!' }, signBridgeProof(BRIDGE_SECRET, '/api/auth/login', body)),
			login(body, signBridgeProof(BRIDGE_SECRET, '/api/auth/register', body)),
			login(body, signBridgeProof('not-the-bridge-secret', '/api/auth/login', body)),
			login(body, signBridgeProof(BRIDGE_SECRET, '/api/auth/login', body, now() - 120)),
			login(body, signBridgeProof(BRIDGE_SECRET, '/api/auth/login', body, now() + 120)),
			login(body, 'garbage'),
		];
		for (const result of await Promise.all(refused)) expect(result.status).toBe(403);
	});

	it('a bad proof never falls back to the token in the body', async () => {
		const result = await login(attemptBody(), `${now()}.${'0'.repeat(64)}`);
		expect(result.status).toBe(403);
	});

	it('is refused by a gateway that holds no bridge secret', async () => {
		const body = attemptBody();
		const result = await login(body, signBridgeProof(BRIDGE_SECRET, '/api/auth/login', body), noBridgeSecret);
		expect(result.status).toBe(403);
	});
});

describe('without a proof, the gateway holds the secret', () => {
	it('refuses the fixed local token: Turnstile is verified, not bypassed', async () => {
		expect((await login(loginBody())).status).toBe(403);
	});
});
