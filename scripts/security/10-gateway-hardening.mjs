#!/usr/bin/env node
/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   10-gateway-hardening.mjs                           :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Integration tests against a RUNNING auth-gateway. Each check skips (never
// fails) when the gateway is unreachable, so the suite still runs on a bare
// checkout. Base URL: AUTH_GATEWAY_TEST_URL (default http://auth-gateway:8787).
//
// Proves: spoofed X-Forwarded-For cannot mint fresh rate-limit buckets,
// /availability is throttled, failed login is a fixed generic 401 with no
// enumeration/leak, and newsletter subscribe is per-target throttled.

import { randomBytes } from 'node:crypto';
import {
	assert,
	config,
	ensureSecurityTestUser,
	fetchWithTimeout,
	gatewayReachable,
	gatewayUrl,
	jsonBody,
	noInternalLeak,
	passed,
	runChecks,
	skipped,
} from './_shared.mjs';

function randomXff() {
	const octet = () => 1 + Math.floor(Math.random() * 253);
	return `${octet()}.${octet()}.${octet()}.${octet()}`;
}

function disposableEmail() {
	return `devfast+nl-${Date.now()}-${randomBytes(4).toString('hex')}@mini-baas.local`;
}

async function getAvailability(headers = {}) {
	const response = await fetchWithTimeout(
		gatewayUrl(`/api/auth/availability?email=${encodeURIComponent(disposableEmail())}`),
		{ method: 'GET', headers },
		4000,
	);
	await response.arrayBuffer().catch(() => undefined);
	return response;
}

async function postLogin(email, password) {
	return fetchWithTimeout(
		gatewayUrl('/api/auth/login'),
		{
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({ email, password, turnstileToken: 'localhost-turnstile-token' }),
		},
		5000,
	);
}

async function postNewsletter(email) {
	return fetchWithTimeout(
		gatewayUrl('/api/newsletter/subscribe'),
		{
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({ email }),
		},
		5000,
	);
}

export async function run() {
	const reachable = await gatewayReachable();

	return await runChecks([
		{
			name: 'rotating X-Forwarded-For does not bypass throttling',
			description: 'Spoofing a unique XFF per request must not mint fresh per-IP buckets; throttling still trips.',
			run: async () => {
				if (!reachable) return skipped(`auth-gateway unreachable at ${gatewayUrl('')} — start the stack to run this.`);
				const statuses = [];
				for (let index = 0; index < 40; index += 1) {
					const response = await getAvailability({ 'x-forwarded-for': randomXff() });
					statuses.push(response.status);
					if (response.status === 429) break;
				}
				assert.ok(statuses.includes(429), `no 429 across ${statuses.length} spoofed-XFF requests: ${statuses.join(',')}`);
				return passed(`Throttling tripped (429) despite per-request unique X-Forwarded-For after ${statuses.length} requests.`);
			},
		},
		{
			name: '/availability is throttled',
			description: 'Bursting GET /api/auth/availability past the per-IP limit returns 429 with a retry-after header.',
			run: async () => {
				if (!reachable) return skipped(`auth-gateway unreachable at ${gatewayUrl('')} — start the stack to run this.`);
				let limited = null;
				for (let index = 0; index < 40; index += 1) {
					const response = await getAvailability();
					if (response.status === 429) {
						limited = response;
						break;
					}
				}
				assert.ok(limited, 'expected a 429 within 40 /availability requests');
				assert.ok(limited.headers.get('retry-after'), '429 must carry a retry-after header');
				return passed(`/availability returned 429 with retry-after=${limited.headers.get('retry-after')}.`);
			},
		},
		{
			name: 'failed login returns a generic 401 with no enumeration/internal leak',
			description: 'Unknown and known emails with a wrong password return the SAME 401 generic body, leaking nothing.',
			run: async () => {
				if (!reachable) return skipped(`auth-gateway unreachable at ${gatewayUrl('')} — start the stack to run this.`);
				const unknownEmail = disposableEmail();
				const unknown = await postLogin(unknownEmail, 'Wrong-Password-1!');
				const unknownBody = await jsonBody(unknown);
				assert.equal(unknown.status, 401, `unknown-email login returned HTTP ${unknown.status}`);
				assert.equal(unknownBody?.message, 'Invalid credentials.', `unexpected unknown-email body: ${JSON.stringify(unknownBody)}`);
				assert.ok(noInternalLeak(JSON.stringify(unknownBody)), `internal leak in unknown-email body: ${JSON.stringify(unknownBody)}`);

				// Same probe for a KNOWN account: the response must be byte-identical
				// so existence cannot be inferred. ensureSecurityTestUser needs the
				// service role + BaaS; if it can't provision, skip the known-email leg.
				let known;
				try {
					await ensureSecurityTestUser();
					known = await postLogin(config.testEmail, 'Definitely-Wrong-1!');
				} catch {
					return passed('Unknown-email login is a generic 401 with no leak (known-email leg skipped: no service role/BaaS).');
				}
				const knownBody = await jsonBody(known);
				assert.equal(known.status, 401, `known-email wrong-password returned HTTP ${known.status}, expected identical 401`);
				assert.equal(knownBody?.message, 'Invalid credentials.', `known-email body differs from generic: ${JSON.stringify(knownBody)}`);
				assert.deepEqual(knownBody, unknownBody, 'known vs unknown email login bodies differ — enables enumeration');
				return passed('Known and unknown emails both return an identical generic 401 "Invalid credentials." with no leak.');
			},
		},
		{
			name: 'newsletter subscribe is per-target throttled',
			description: 'Repeated subscribe for the SAME email is capped per-target (429), blocking email-bomb amplification.',
			run: async () => {
				if (!reachable) return skipped(`auth-gateway unreachable at ${gatewayUrl('')} — start the stack to run this.`);
				const target = disposableEmail();
				let limited = null;
				for (let index = 0; index < 5; index += 1) {
					const response = await postNewsletter(target);
					if (response.status === 429) {
						limited = await jsonBody(response);
						break;
					}
					await response.arrayBuffer().catch(() => undefined);
				}
				assert.ok(limited, `expected a 429 within 5 subscribes for ${target}`);
				const message = String(limited?.message ?? '').toLowerCase();
				assert.ok(
					message.includes('address') || message.includes('inbox'),
					`429 message should reference the target address/inbox (per-target), got: ${JSON.stringify(limited)}`,
				);
				return passed('Repeated subscribe for one address tripped a per-target 429 referencing the inbox/address.');
			},
		},
	]);
}
