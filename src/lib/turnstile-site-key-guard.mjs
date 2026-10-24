/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   turnstile-site-key-guard.mjs                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/24 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/24 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Fails the site build when a public https deploy would ship without a real Turnstile site key.
// Pure and import.meta-free so astro.config.mjs can import it; the check is not run by CI (the build
// is a Vercel step), hence the wiring test.
// Caveat: shape match only. A well-formed key that Cloudflare does not know, or one for another
// hostname, passes here and fails at the widget. Escape hatch: none; use a real key or a loopback origin.
import { isProductionOrigin } from '../../scripts/auth/guards.mjs';

export const CLOUDFLARE_TURNSTILE_TEST_SITE_KEYS = new Set([
	'1x00000000000000000000AA',
	'2x00000000000000000000AB',
	'3x00000000000000000000FF',
]);

export const LOCAL_DEV_SITE_KEY = 'local-dev-turnstile-key';

export function isUnusableSiteKey(siteKey) {
	const key = String(siteKey ?? '').trim();
	return key === '' || key === LOCAL_DEV_SITE_KEY || CLOUDFLARE_TURNSTILE_TEST_SITE_KEYS.has(key);
}

export function assertTurnstileSiteKey({ siteUrl, siteKey }) {
	if (!isProductionOrigin(siteUrl) || !isUnusableSiteKey(siteKey)) return;
	throw new Error('PUBLIC_TURNSTILE_SITE_KEY is empty, local-dev-turnstile-key or a Cloudflare test key on a public https PUBLIC_SITE_URL. Create a widget at dash.cloudflare.com -> Turnstile and set its site key, or the production site cannot sign anyone in.');
}
