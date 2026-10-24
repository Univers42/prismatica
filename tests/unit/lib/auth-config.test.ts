/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   auth-config.test.ts                                :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/24 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/24 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { afterEach, describe, expect, it, vi } from 'vitest';

async function siteKeyFor(value: string): Promise<string> {
	vi.stubEnv('PUBLIC_TURNSTILE_SITE_KEY', value);
	vi.resetModules();
	return (await import('../../../src/lib/auth-config')).authConfig.turnstileSiteKey;
}

describe('authConfig.turnstileSiteKey', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it.each(['1x00000000000000000000AA', '2x00000000000000000000AB', '3x00000000000000000000FF'])('blanks the Cloudflare test key %s', async (key) => {
		expect(await siteKeyFor(key)).toBe('');
	});

	it('keeps a real-shaped key', async () => {
		expect(await siteKeyFor('0x4AAAAAAABkMYinukE8nzYS')).toBe('0x4AAAAAAABkMYinukE8nzYS');
	});
});
