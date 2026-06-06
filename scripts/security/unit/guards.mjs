#!/usr/bin/env node
/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   guards.mjs                                         :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Pure unit tests for the fail-closed startup guards. No network/stack.
// Proves anti-abuse controls cannot be silently disabled on a public origin
// while local dev with the same convenient flags still boots.

import { assert, passed, runChecks } from '../_shared.mjs';
import { collectStartupViolations, isProductionOrigin } from '../../auth/guards.mjs';

const insecureProdConfig = {
	siteUrl: 'https://prismatica.app',
	turnstileBypassLocal: true,
	requireEmailVerification: false,
	turnstileSecret: '',
	trustedProxyHops: 0,
	serviceKey: '',
};

const localConfigWithBypass = {
	siteUrl: 'https://localhost:4322',
	turnstileBypassLocal: true,
	requireEmailVerification: false,
	turnstileSecret: '',
	trustedProxyHops: 0,
	serviceKey: '',
};

export async function run() {
	return await runChecks([
		{
			name: 'isProductionOrigin classifies localhost vs public https',
			description: 'localhost https is not a production origin; a public https host is.',
			run: async () => {
				assert.equal(isProductionOrigin('https://localhost:4322'), false, 'localhost flagged as production');
				assert.equal(isProductionOrigin('https://prismatica.app'), true, 'public https not flagged as production');
				return passed('isProductionOrigin returned false for localhost and true for prismatica.app.');
			},
		},
		{
			name: 'local config with bypass flags is allowed to boot',
			description: 'A localhost origin must yield zero violations even with bypass flags enabled.',
			run: async () => {
				const violations = collectStartupViolations(localConfigWithBypass);
				assert.deepEqual(violations, [], `localhost config produced violations: ${violations.join(' | ')}`);
				return passed('Localhost config with bypass flags produced no violations.');
			},
		},
		{
			name: 'public https with anti-abuse disabled is refused',
			description: 'A public https origin with every anti-abuse control off yields >=5 violations.',
			run: async () => {
				const violations = collectStartupViolations(insecureProdConfig);
				assert.ok(violations.length >= 5, `expected >=5 violations, got ${violations.length}: ${violations.join(' | ')}`);
				return passed(`Insecure prod config produced ${violations.length} startup violations.`);
			},
		},
	]);
}
