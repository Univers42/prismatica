/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   astro-config-guard.test.ts                         :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/24 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/24 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = readFileSync('astro.config.mjs', 'utf8');

describe('astro.config.mjs Turnstile build guard', () => {
	it('imports the predicate from the guard module', () => {
		expect(config).toMatch(/import \{ assertTurnstileSiteKey \} from '\.\/src\/lib\/turnstile-site-key-guard\.mjs'/);
	});

	it('calls it with the loaded env, after loadEnv', () => {
		const call = config.indexOf('assertTurnstileSiteKey({ siteUrl: env.PUBLIC_SITE_URL, siteKey: env.PUBLIC_TURNSTILE_SITE_KEY })');
		expect(call).toBeGreaterThan(config.indexOf('loadEnv(process.env'));
	});
});
