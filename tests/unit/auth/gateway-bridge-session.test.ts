// @vitest-environment node
// The payload the gateway HMAC-signs for the osionos bridge says whether the e-mail is verified (R2a).
import { createHmac } from 'node:crypto';
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, listen, servers, startFakeKong, startGateway, stopAll, type Gateway } from './gateway-harness';

const SECRET = 'bridge-shared-secret-for-tests-0123456789';
type Seen = { headers: http.IncomingHttpHeaders; body: string };
const bridgeCalls: Seen[] = [];
let confirmedAt: string | null = null;
let gateway: Gateway;

function fakeBridge() {
	return http.createServer((request, response) => {
		let body = '';
		request.on('data', (chunk) => (body += chunk));
		request.on('end', () => {
			bridgeCalls.push({ headers: request.headers, body });
			response.writeHead(200, { 'content-type': 'application/json' });
			response.end('{}');
		});
	});
}

// The shared fake Kong answers /auth/v1/user with {}; this one fronts it for the user lookup only.
function userKong() {
	return http.createServer((request, response) => {
		response.writeHead(200, { 'content-type': 'application/json' });
		response.end(JSON.stringify({ id: 'u1', email: 'ines@arlet.test', email_confirmed_at: confirmedAt, user_metadata: { username: 'ines' } }));
	});
}

beforeAll(async () => {
	await startFakeKong();
	const bridge = fakeBridge();
	const kong = userKong();
	const [bridgePort, kongPort] = [await listen(bridge), await listen(kong)];
	servers.push(bridge, kong);
	gateway = await startGateway({ PUBLIC_BAAS_URL: `http://127.0.0.1:${kongPort}`, OSIONOS_BRIDGE_URL: `http://127.0.0.1:${bridgePort}/s`, OSIONOS_BRIDGE_SHARED_SECRET: SECRET });
}, 30_000);

afterAll(stopAll);

async function signedPayload(confirmed: string | null) {
	confirmedAt = confirmed;
	bridgeCalls.length = 0;
	const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
	expect(result.status).toBe(200);
	const seen = bridgeCalls[0];
	return { seen, payload: JSON.parse(seen.body) };
}

function expectedSignature(timestamp: string, payload: Record<string, unknown>) {
	const sorted = Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)));
	return createHmac('sha256', SECRET).update(`${timestamp}.${JSON.stringify(sorted)}`).digest('hex');
}

describe('POST /api/auth/osionos-session', () => {
	it.each([
		['a confirmed user', '2026-10-18T10:00:00Z', true],
		['an unconfirmed user', null, false],
	])('signs emailVerified for %s, covered by the signature', async (_label, confirmed, expected) => {
		const { seen, payload } = await signedPayload(confirmed);
		expect(payload.emailVerified).toBe(expected);
		const timestamp = String(seen.headers['x-prismatica-bridge-timestamp']);
		expect(seen.headers['x-prismatica-bridge-signature']).toBe(expectedSignature(timestamp, payload));
		expect(seen.headers['x-prismatica-bridge-signature']).not.toBe(expectedSignature(timestamp, { ...payload, emailVerified: !expected }));
	});
});

