/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   auth-config.ts                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

const CLOUDFLARE_TURNSTILE_TEST_SITE_KEYS = new Set([
	'1x00000000000000000000AA',
	'2x00000000000000000000AB',
	'3x00000000000000000000FF',
]);

const LOCAL_DEV_TURNSTILE_SITE_KEY = 'local-dev-turnstile-key';

/**
 * The site key a Turnstile widget renders with, or '' when this build has no widget: no key, a
 * Cloudflare test key, or the local dev placeholder. The layout loads Cloudflare's script only for
 * a widget key, and the portal sends the gateway's fixed token otherwise. Both read this one value:
 * when they read the key separately, a build with no key loaded no script while the portal waited
 * for one, and every sign-in on prismatica-eta stopped at "Please complete the verification check"
 * without reaching the gateway (2026-11-03).
 */
export function turnstileWidgetSiteKey(rawKey: string): string {
	const key = rawKey.trim();
	return CLOUDFLARE_TURNSTILE_TEST_SITE_KEYS.has(key) || key === LOCAL_DEV_TURNSTILE_SITE_KEY ? '' : key;
}

const rawTurnstileSiteKey = String(import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? '');
const rawRequireEmailVerification = String(import.meta.env.PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION ?? import.meta.env.AUTH_REQUIRE_EMAIL_VERIFICATION ?? 'true').trim().toLowerCase();

export const authConfig = {
	gatewayUrl: import.meta.env.PUBLIC_AUTH_GATEWAY_URL ?? '/api/auth',
	turnstileSiteKey: turnstileWidgetSiteKey(rawTurnstileSiteKey),
	portalUrl: import.meta.env.PUBLIC_PORTAL_URL ?? 'https://portal.example.com/sign-in',
	requireEmailVerification: rawRequireEmailVerification !== 'false',
} as const;

export const isTurnstileConfigured = (): boolean => Boolean(authConfig.turnstileSiteKey);
