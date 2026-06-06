#!/usr/bin/env node
/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   net-ip.mjs                                         :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Pure unit tests for the trusted client-IP derivation. No network/stack.
// Proves a client rotating X-Forwarded-For cannot shift the trusted tail and
// therefore cannot mint fresh per-IP rate-limit buckets.

import { assert, passed, runChecks } from '../_shared.mjs';
import { deriveClientIp, normalizeIp } from '../../auth/net-ip.mjs';

function fakeRequest(xff, remoteAddress = '172.18.0.5') {
	const headers = {};
	if (xff !== undefined) headers['x-forwarded-for'] = xff;
	return { headers, socket: { remoteAddress } };
}

export async function run() {
	return await runChecks([
		{
			name: 'hops=2 reads the entry before the trusted tail',
			description: 'With 2 trusted proxy hops, the client IP is the entry immediately left of the trusted tail.',
			run: async () => {
				const request = fakeRequest('9.9.9.9, 203.0.113.7, 172.18.0.5');
				const ip = deriveClientIp(request, { trustedProxyHops: 2 });
				assert.equal(ip, '203.0.113.7', `expected 203.0.113.7, got ${ip}`);
				return passed('hops=2 selects 203.0.113.7 from the chain.');
			},
		},
		{
			name: 'prepended spoof entries do not shift the trusted tail',
			description: 'Extra attacker-controlled XFF entries on the left must not change the derived client IP.',
			run: async () => {
				const base = deriveClientIp(fakeRequest('9.9.9.9, 203.0.113.7, 172.18.0.5'), { trustedProxyHops: 2 });
				const spoofed = deriveClientIp(
					fakeRequest('1.2.3.4, 5.6.7.8, 9.9.9.9, 203.0.113.7, 172.18.0.5'),
					{ trustedProxyHops: 2 },
				);
				assert.equal(spoofed, base, `spoofed chain shifted client IP: base=${base} spoofed=${spoofed}`);
				assert.equal(spoofed, '203.0.113.7', `spoofed chain produced ${spoofed}`);
				return passed('Prepended spoof entries left the trusted tail fixed at 203.0.113.7.');
			},
		},
		{
			name: 'hops=1 reads the right-most entry',
			description: 'A single trusted hop derives the client from the right-most chain entry.',
			run: async () => {
				const ip = deriveClientIp(fakeRequest('9.9.9.9, 203.0.113.7, 172.18.0.5'), { trustedProxyHops: 1 });
				assert.equal(ip, '172.18.0.5', `expected right-most 172.18.0.5, got ${ip}`);
				return passed('hops=1 selects the right-most chain entry.');
			},
		},
		{
			name: 'hops=0 ignores X-Forwarded-For entirely',
			description: 'With no trusted proxy, XFF is ignored and the socket peer is the client.',
			run: async () => {
				const ip = deriveClientIp(fakeRequest('1.2.3.4, 5.6.7.8', '198.51.100.9'), { trustedProxyHops: 0 });
				assert.equal(ip, '198.51.100.9', `hops=0 must use socket peer, got ${ip}`);
				return passed('hops=0 ignored XFF and used the socket remoteAddress.');
			},
		},
		{
			name: 'missing X-Forwarded-For falls back to the socket peer',
			description: 'A request with no XFF header derives the client from the socket peer.',
			run: async () => {
				const ip = deriveClientIp(fakeRequest(undefined, '203.0.113.42'), { trustedProxyHops: 2 });
				assert.equal(ip, '203.0.113.42', `missing XFF must use socket peer, got ${ip}`);
				return passed('Missing XFF fell back to the socket remoteAddress.');
			},
		},
		{
			name: 'normalizeIp unwraps IPv4-mapped IPv6',
			description: 'normalizeIp("::ffff:127.0.0.1") yields the bare IPv4 form.',
			run: async () => {
				assert.equal(normalizeIp('::ffff:127.0.0.1'), '127.0.0.1');
				return passed('normalizeIp unwrapped ::ffff:127.0.0.1 to 127.0.0.1.');
			},
		},
	]);
}
