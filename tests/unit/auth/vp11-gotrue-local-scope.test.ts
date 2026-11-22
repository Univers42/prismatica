// @vitest-environment node
// The verdict logic of scripts/verify/vp11-gotrue-local-scope.mjs, the operator's proof against a
// real GoTrue that logout?scope=local ends only the token's own session (devil ruling VP11).
import { describe, expect, it } from 'vitest';
import { runLocalScopeProof } from '../../../scripts/verify/vp11-gotrue-local-scope.mjs';
import { fail, ok } from './fakes';

/** GoTrue sessions in memory; `revokeAll` makes any logout behave like scope=global. */
function fakeGotrue({ revokeAll = false } = {}) {
	let serial = 0;
	const live = new Set<number>();
	const sessionOf = new Map<string, number>();
	const issue = (session: number) => {
		serial += 1;
		sessionOf.set(`at-${serial}`, session).set(`rt-${serial}`, session);
		return ok({ access_token: `at-${serial}`, refresh_token: `rt-${serial}` });
	};
	return {
		passwordGrant: async () => {
			live.add(serial + 1);
			return issue(serial + 1);
		},
		logout: async (token: string, scope: string) => {
			if (revokeAll || scope !== 'local') live.clear();
			else live.delete(sessionOf.get(token) ?? -1);
			return { ok: true, status: 204, body: {} };
		},
		refresh: async (token: string) => (live.has(sessionOf.get(token) ?? -1) ? issue(sessionOf.get(token) as number) : fail(400, { error_code: 'refresh_token_not_found' })),
	};
}

describe('runLocalScopeProof', () => {
	it('passes when the revoked session stops refreshing and the other one still refreshes', async () => {
		const proof = await runLocalScopeProof(fakeGotrue());
		expect(proof.pass).toBe(true);
		expect(proof.steps.map((step) => [step.name, step.status])).toEqual([
			['grant session A', 200],
			['grant session B', 200],
			['logout B scope=local', 204],
			['refresh A (must answer 2xx)', 200],
			['refresh B (must be refused)', 400],
			['cleanup: logout A scope=local', 204],
		]);
	});

	it('fails when the logout also ended the other session', async () => {
		const proof = await runLocalScopeProof(fakeGotrue({ revokeAll: true }));
		expect(proof.pass).toBe(false);
	});

	it('never puts a token in its steps', async () => {
		const proof = await runLocalScopeProof(fakeGotrue());
		expect(JSON.stringify(proof)).not.toMatch(/at-|rt-/);
	});
});
