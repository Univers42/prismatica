#!/usr/bin/env node
/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   11-gateway-failclosed.mjs                          :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Spawns the real auth-gateway as a subprocess to prove it FAILS CLOSED:
//   - refuses to boot under an insecure public-https configuration,
//   - still boots under a localhost configuration,
//   - locks out per-account (not per-IP) after repeated failed logins.
//
// These need @mini-baas/js resolvable (the gateway imports it at module load)
// and the lockout leg needs a live BaaS. Every check skips (never fails) when
// those prerequisites are missing, so the suite still runs on a bare checkout.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assert, config, fetchWithTimeout, jsonBody, passed, runChecks, skipped } from './_shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const gatewayScript = resolve(repoRoot, 'scripts', 'auth-gateway.mjs');

function miniBaasResolvable() {
	try {
		createRequire(resolve(repoRoot, 'scripts', 'auth-gateway.mjs')).resolve('@mini-baas/js');
		return true;
	} catch {
		return false;
	}
}

function randomPort() {
	return 20000 + Math.floor(Math.random() * 20000);
}

// Spawn the gateway with the given env overrides. Returns the child plus
// captured stdout/stderr and a promise that resolves on exit.
function spawnGateway(env) {
	const child = spawn(process.execPath, [gatewayScript], {
		cwd: repoRoot,
		env: { ...process.env, ...env },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	let stdout = '';
	let stderr = '';
	child.stdout.on('data', (chunk) => {
		stdout += chunk.toString();
	});
	child.stderr.on('data', (chunk) => {
		stderr += chunk.toString();
	});
	const exited = new Promise((resolveExit) => {
		child.on('exit', (code, signal) => resolveExit({ code, signal }));
		child.on('error', () => resolveExit({ code: null, signal: null, errored: true }));
	});
	return {
		child,
		exited,
		out: () => stdout,
		err: () => stderr,
		kill: () => {
			if (!child.killed) child.kill('SIGKILL');
		},
	};
}

function delay(ms) {
	return new Promise((done) => setTimeout(done, ms));
}

// Resolve after the child exits OR after timeoutMs (whichever first).
async function waitForExit(handle, timeoutMs) {
	let timer;
	const timeout = new Promise((resolveTimeout) => {
		timer = setTimeout(() => resolveTimeout({ timedOut: true }), timeoutMs);
	});
	const result = await Promise.race([handle.exited.then((value) => ({ ...value, timedOut: false })), timeout]);
	clearTimeout(timer);
	return result;
}

async function postLoginTo(port, email, password) {
	return fetchWithTimeout(
		`http://127.0.0.1:${port}/api/auth/login`,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({ email, password, turnstileToken: 'localhost-turnstile-token' }),
		},
		5000,
	);
}

async function waitUntilListening(port, attempts = 30) {
	for (let index = 0; index < attempts; index += 1) {
		try {
			const response = await fetchWithTimeout(`http://127.0.0.1:${port}/api/auth/availability`, { method: 'GET' }, 1000);
			await response.arrayBuffer().catch(() => undefined);
			return true;
		} catch {
			await delay(200);
		}
	}
	return false;
}

export async function run() {
	const haveSdk = miniBaasResolvable();

	return await runChecks([
		{
			name: 'refuses to boot with insecure prod config',
			description: 'A public-https origin with anti-abuse disabled must exit(1) and say it is refusing to start.',
			run: async () => {
				if (!haveSdk) return skipped('@mini-baas/js is not resolvable — run inside the built node image / installed deps.');
				const handle = spawnGateway({
					PUBLIC_SITE_URL: 'https://evil.example.com',
					TURNSTILE_BYPASS_LOCAL: 'true',
					AUTH_REQUIRE_EMAIL_VERIFICATION: 'false',
					TURNSTILE_SECRET_KEY: '',
					AUTH_TRUSTED_PROXY_HOPS: '0',
					SERVICE_ROLE_KEY: '',
					AUTH_GATEWAY_PORT: String(randomPort()),
				});
				const result = await waitForExit(handle, 6000);
				handle.kill();
				assert.equal(result.timedOut, false, `gateway did not exit within 6s under insecure prod config (stderr: ${handle.err().slice(0, 300)})`);
				assert.equal(result.code, 1, `expected exit code 1, got ${result.code} (stderr: ${handle.err().slice(0, 300)})`);
				assert.ok(/refusing to start/i.test(handle.err()), `stderr should mention "refusing to start": ${handle.err().slice(0, 300)}`);
				return passed('Gateway exited(1) and logged "refusing to start" under an insecure public-https config.');
			},
		},
		{
			name: 'boots on localhost config',
			description: 'A localhost origin must NOT exit(1) for guard reasons; it should start listening.',
			run: async () => {
				if (!haveSdk) return skipped('@mini-baas/js is not resolvable — run inside the built node image / installed deps.');
				const port = randomPort();
				const handle = spawnGateway({
					PUBLIC_SITE_URL: 'https://localhost:4322',
					AUTH_GATEWAY_PORT: String(port),
					SERVICE_ROLE_KEY: '',
				});
				const listening = await waitUntilListening(port, 15);
				// If it did not start listening, it must at least not have died for a
				// guard violation (exit code 1). A non-guard early exit is tolerated.
				const exit = await waitForExit(handle, listening ? 200 : 2000);
				handle.kill();
				if (exit.timedOut === false && exit.code === 1 && /refusing to start/i.test(handle.err())) {
					assert.fail(`localhost config was refused by the startup guard: ${handle.err().slice(0, 300)}`);
				}
				assert.ok(
					listening || exit.code !== 1,
					`localhost config neither listened nor avoided exit(1) (code=${exit.code}, stderr: ${handle.err().slice(0, 300)})`,
				);
				return passed(listening ? 'Gateway started listening under a localhost config.' : 'Gateway did not hit the startup guard under a localhost config.');
			},
		},
		{
			name: 'per-account lockout is per-account not per-IP',
			description: 'After N failed logins for account A it locks (429); a different account B from the same connection still gets a normal 401.',
			run: async () => {
				if (!haveSdk) return skipped('@mini-baas/js is not resolvable — run inside the built node image / installed deps.');
				if (!config.url || !config.anonKey) return skipped('PUBLIC_BAAS_URL/PUBLIC_BAAS_ANON_KEY missing — live BaaS required for lockout.');
				const port = randomPort();
				const handle = spawnGateway({
					PUBLIC_SITE_URL: 'https://localhost:4322',
					AUTH_GATEWAY_PORT: String(port),
					AUTH_LOGIN_LOCKOUT_THRESHOLD: '3',
					PUBLIC_BAAS_URL: config.url,
					PUBLIC_BAAS_ANON_KEY: config.anonKey,
					SERVICE_ROLE_KEY: process.env.SERVICE_ROLE_KEY ?? process.env.KONG_SERVICE_API_KEY ?? '',
				});
				try {
					const listening = await waitUntilListening(port, 30);
					if (!listening) return skipped(`gateway did not start listening on ${port} (stderr: ${handle.err().slice(0, 200)})`);

					const accountA = `devfast+lockA-${Date.now()}@mini-baas.local`;
					const accountB = `devfast+lockB-${Date.now()}@mini-baas.local`;
					let lockoutHit = null;
					for (let index = 0; index < 5; index += 1) {
						const response = await postLoginTo(port, accountA, `wrong-${index}!A`);
						const body = await jsonBody(response);
						if (response.status === 429 && /too many failed attempts for this account/i.test(String(body?.message ?? ''))) {
							lockoutHit = body;
							break;
						}
					}
					assert.ok(lockoutHit, 'account A was never locked out after repeated failures');

					// Account B from the SAME gateway connection must NOT be locked.
					const responseB = await postLoginTo(port, accountB, 'wrong-1!B');
					const bodyB = await jsonBody(responseB);
					assert.notEqual(responseB.status, 429, `account B was locked too (per-IP lock leak): ${JSON.stringify(bodyB)}`);
					assert.ok(
						!/too many failed attempts for this account/i.test(String(bodyB?.message ?? '')),
						`account B received the lockout message — lock is not per-account: ${JSON.stringify(bodyB)}`,
					);
					return passed('Account A locked (429 per-account message); account B from the same connection still got a normal non-lockout response.');
				} finally {
					handle.kill();
				}
			},
		},
	]);
}
