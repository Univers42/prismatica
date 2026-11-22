#!/usr/bin/env node
// Operator proof for verify-password ruling VP11: against a real GoTrue, logout?scope=local must end
// only the session whose token it is given. /api/auth/verify-password revokes every session it
// mints that way; were the scope global, each step-up would sign the user out everywhere.
//
// Usage (credentials by env name only; nothing secret is printed, tokens never leave memory):
//   VP11_BAAS_URL=https://… VP11_ANON_KEY=… VP11_EMAIL=… VP11_PASSWORD=… node scripts/verify/vp11-gotrue-local-scope.mjs
// VP11_BAAS_URL / VP11_ANON_KEY fall back to PUBLIC_BAAS_URL / PUBLIC_BAAS_ANON_KEY.
// Exit: 0 PASS, 1 FAIL, 2 missing configuration. Use a test account: it mints two sessions,
// ends both, and spends no lockout budget (no wrong password is sent).
//
// Caveat: "refused" is any non-2xx refresh of the revoked session (GoTrue answers 400
// refresh_token_not_found, not 401); a GoTrue that is down at that one step would read as refused,
// so a PASS also needs "refresh A" to have answered 2xx in the same run.

import { fileURLToPath } from 'node:url';
import { createGotrueApi } from '../auth/gotrue-api.mjs';

const REQUIRED = ['VP11_EMAIL', 'VP11_PASSWORD'];

function step(name, result) {
	const errorCode = result.body?.error_code ?? result.body?.error;
	return { name, status: result.status, ok: Boolean(result.ok), ...(typeof errorCode === 'string' ? { error_code: errorCode } : {}) };
}

/** Two sessions, one revoked with scope local; passes when only that one stops refreshing. */
export async function runLocalScopeProof(gotrue, { email = '', password = '' } = {}) {
	const steps = [];
	const record = (name, result) => (steps.push(step(name, result)), result);
	const sessionA = record('grant session A', await gotrue.passwordGrant(email, password));
	const sessionB = record('grant session B', await gotrue.passwordGrant(email, password));
	if (!sessionA.ok || !sessionB.ok) return { pass: false, steps };
	const revoke = record('logout B scope=local', await gotrue.logout(sessionB.body.access_token, 'local'));
	const refreshedA = record('refresh A (must answer 2xx)', await gotrue.refresh(sessionA.body.refresh_token));
	const refreshedB = record('refresh B (must be refused)', await gotrue.refresh(sessionB.body.refresh_token));
	const cleanupToken = refreshedA.ok ? refreshedA.body.access_token : sessionA.body.access_token;
	record('cleanup: logout A scope=local', await gotrue.logout(cleanupToken, 'local'));
	return { pass: Boolean(revoke.ok && refreshedA.ok && !refreshedB.ok), steps };
}

function configFrom(env) {
	const config = { baseUrl: env.VP11_BAAS_URL || env.PUBLIC_BAAS_URL || '', anonKey: env.VP11_ANON_KEY || env.PUBLIC_BAAS_ANON_KEY || '', email: env.VP11_EMAIL || '', password: env.VP11_PASSWORD || '' };
	const missing = [...REQUIRED.filter((name) => !env[name]), ...(config.baseUrl ? [] : ['VP11_BAAS_URL']), ...(config.anonKey ? [] : ['VP11_ANON_KEY'])];
	return { config, missing };
}

async function main(env) {
	const { config, missing } = configFrom(env);
	if (missing.length) {
		console.error(`vp11: unset: ${missing.join(', ')}`);
		return 2;
	}
	const proof = await runLocalScopeProof(createGotrueApi(config), config);
	for (const entry of proof.steps) console.log(`${entry.ok ? 'ok  ' : 'nok '} ${entry.name}: HTTP ${entry.status}${entry.error_code ? ` (${entry.error_code})` : ''}`);
	console.log(proof.pass ? 'PASS: scope=local ended only the revoked session' : 'FAIL: scope=local did not behave as VP11 requires');
	return proof.pass ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await main(process.env);
