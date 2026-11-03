// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { acceptBridgeProof, BRIDGE_PROOF_WINDOW_SEC, signBridgeProof, stableStringify } from '../../../scripts/auth/bridge-proof.mjs';
import { MemoryStore } from '../../../scripts/auth/store.mjs';

const secret = 's3cret';
const path = '/api/auth/login';
const body = { email: 'a@b.test', password: 'P', turnstileToken: 'spent-token' };
const T = 1_800_000_000;

const accept = (header: unknown, overrides: Partial<{ body: object; path: string; nowSec: number; secret: string; store: MemoryStore }> = {}) =>
	acceptBridgeProof({ header, secret, path, body, store: new MemoryStore(), nowSec: T, ...overrides });

describe('bridge proof', () => {
	it('accepts a proof for this path and body', async () => {
		expect(await accept(signBridgeProof(secret, path, body, T))).toBe(true);
	});

	it('gives two attempts in one second, each with its own token, two distinct proofs', async () => {
		const store = new MemoryStore();
		const again = { ...body, turnstileToken: 'second-token' };
		expect(signBridgeProof(secret, path, again, T)).not.toBe(signBridgeProof(secret, path, body, T));
		expect(await accept(signBridgeProof(secret, path, body, T), { store })).toBe(true);
		expect(await accept(signBridgeProof(secret, path, again, T), { store, body: again })).toBe(true);
		await store.close();
	});

	it('accepts the edge of the window and nothing past it', async () => {
		const proof = signBridgeProof(secret, path, body, T);
		expect(await accept(proof, { nowSec: T + BRIDGE_PROOF_WINDOW_SEC })).toBe(true);
		expect(await accept(proof, { nowSec: T + BRIDGE_PROOF_WINDOW_SEC + 1 })).toBe(false);
		expect(await accept(proof, { nowSec: T - BRIDGE_PROOF_WINDOW_SEC - 1 })).toBe(false);
	});

	it('is single-use in one store', async () => {
		const store = new MemoryStore();
		const proof = signBridgeProof(secret, path, body, T);
		expect(await accept(proof, { store })).toBe(true);
		expect(await accept(proof, { store })).toBe(false);
		await store.close();
	});

	it('refuses malformed headers, an empty secret and a non-string header', async () => {
		for (const header of ['', 'abc', `${T}.xyz`, `${T}.${'a'.repeat(63)}`, `-1.${'a'.repeat(64)}`, `${T}.${'a'.repeat(64)}, ${T}.${'a'.repeat(64)}`]) {
			expect(await accept(header), header).toBe(false);
		}
		expect(await accept(['x'])).toBe(false);
		expect(await accept(signBridgeProof('', path, body, T), { secret: '' })).toBe(false);
	});

	it('is byte for byte what the bridge signs (vector shared with osionos tests/bridge/bridge-auth-turnstile.test.mjs)', () => {
		const vectorBody = { email: 'ada@example.com', password: 'correct horse battery', turnstileToken: 'real-token' };
		expect(signBridgeProof('vector-secret', '/api/auth/login', vectorBody, 1_800_000_000)).toBe(
			'1800000000.7114dc30fde239163ade551dcefd297785c75d8677c1494cf77344acee6c814e',
		);
	});

	it('serialises keys in one order at every depth', () => {
		expect(stableStringify({ b: 1, a: { d: [2, { f: 1, e: 0 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"e":0,"f":1}]},"b":1}');
	});
});
