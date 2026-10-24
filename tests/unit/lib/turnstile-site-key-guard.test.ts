/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   turnstile-site-key-guard.test.ts                   :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/24 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/24 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { describe, expect, it } from 'vitest';
import { assertTurnstileSiteKey } from '../../../src/lib/turnstile-site-key-guard.mjs';

const REAL_SHAPED = '0x4AAAAAAABkMYinukE8nzYS';

describe('assertTurnstileSiteKey', () => {
	it.each([
		['empty', ''],
		['undefined', undefined],
		['whitespace', '   '],
		['local-dev-turnstile-key', 'local-dev-turnstile-key'],
		['Cloudflare always-pass', '1x00000000000000000000AA'],
		['Cloudflare always-block', '2x00000000000000000000AB'],
		['Cloudflare interactive', '3x00000000000000000000FF'],
	])('refuses %s on a public https origin', (_label, siteKey) => {
		expect(() => assertTurnstileSiteKey({ siteUrl: 'https://prismatica.example', siteKey })).toThrow(/PUBLIC_TURNSTILE_SITE_KEY/);
	});

	it('passes a real-shaped key on a public https origin', () => {
		expect(() => assertTurnstileSiteKey({ siteUrl: 'https://prismatica.example', siteKey: REAL_SHAPED })).not.toThrow();
	});

	it.each(['https://localhost:4322', 'http://prismatica.example', 'http://localhost:4322', undefined, 'not a url'])('lets %s build without a key', (siteUrl) => {
		expect(() => assertTurnstileSiteKey({ siteUrl, siteKey: '' })).not.toThrow();
	});
});
