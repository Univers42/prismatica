import { vi } from 'vitest';
import { MemoryStore } from '../../../scripts/auth/store.mjs';

export type Result = { ok: boolean; status: number; body: Record<string, any> };
export const ok = (body: Record<string, any> = {}): Result => ({ ok: true, status: 200, body });
export const fail = (status: number, body: Record<string, any> = {}): Result => ({ ok: false, status, body });

/** A GoTrue double: every method is a vi.fn answering `ok({})` unless a test overrides it. */
export function fakeGotrue(overrides: Partial<Record<string, (...args: any[]) => Promise<Result>>> = {}) {
	const names = ['verify', 'refresh', 'logout', 'updatePassword', 'generateLink', 'listFactors', 'mfaChallenge', 'mfaVerify'];
	const api: Record<string, ReturnType<typeof vi.fn>> = {};
	for (const name of names) api[name] = vi.fn(overrides[name] ?? (async () => ok({})));
	const totalCalls = () => names.reduce((sum, name) => sum + api[name].mock.calls.length, 0);
	return { api, totalCalls };
}

export function memoryStore() {
	const store = new MemoryStore({ maxEntries: 1000, sweepMs: 60_000 });
	clearInterval(store.sweeper);
	return store;
}
