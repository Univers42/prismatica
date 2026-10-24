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

import { CLOUDFLARE_TURNSTILE_TEST_SITE_KEYS } from './turnstile-site-key-guard.mjs';

const rawTurnstileSiteKey = String(import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
const rawRequireEmailVerification = String(import.meta.env.PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION ?? import.meta.env.AUTH_REQUIRE_EMAIL_VERIFICATION ?? 'true').trim().toLowerCase();

export const authConfig = {
	gatewayUrl: import.meta.env.PUBLIC_AUTH_GATEWAY_URL ?? '/api/auth',
	turnstileSiteKey: CLOUDFLARE_TURNSTILE_TEST_SITE_KEYS.has(rawTurnstileSiteKey) ? '' : rawTurnstileSiteKey,
	portalUrl: import.meta.env.PUBLIC_PORTAL_URL ?? 'https://portal.example.com/sign-in',
	requireEmailVerification: rawRequireEmailVerification !== 'false',
} as const;

export const isTurnstileConfigured = (): boolean => Boolean(authConfig.turnstileSiteKey);
