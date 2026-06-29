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

// Fail-closed startup guards.
//
// THREAT (MEDIUM): several anti-abuse controls can be silently disabled by
// config — TURNSTILE_BYPASS_LOCAL=true makes Turnstile always pass,
// AUTH_REQUIRE_EMAIL_VERIFICATION=false mints confirmed accounts with no email
// proof. These are correct for local dev but catastrophic if they leak into a
// production deployment. Defaults that are convenient locally must not be the
// silent default in prod.
//
// FIX: detect whether we are running against a real (public https) origin and,
// if so, REFUSE TO BOOT when any anti-abuse control is disabled. Local dev
// (localhost / *.local / RFC1918 / non-https) is unaffected.

export function isProductionOrigin(siteUrl) {
	let url;
	try {
		url = new URL(String(siteUrl ?? ''));
	} catch {
		return false;
	}
	if (url.protocol !== 'https:') return false;
	const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
	const isLocal =
		host === 'localhost' ||
		host === '127.0.0.1' ||
		host === '::1' ||
		host.endsWith('.local') ||
		host.endsWith('.localhost') ||
		host.endsWith('.internal') ||
		/^10\./.test(host) ||
		/^192\.168\./.test(host) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
		/^127\./.test(host);
	return !isLocal;
}

// Returns a list of human-readable violations. Empty list = safe to boot.
// Only enforced when the site origin is a public https host.
export function collectStartupViolations(config) {
	const violations = [];
	if (!isProductionOrigin(config.siteUrl)) return violations;

	// AUTH_DEMO_INSECURE=true relaxes ONLY the anti-abuse controls (Turnstile,
	// email verification) for a non-production demo on a public https origin —
	// the hard requirements below (trusted-proxy hops, service key) stay enforced.
	// NEVER set this on a real production deployment; it disables the CAPTCHA.
	const demoInsecure = config.demoInsecure === true;

	if (!demoInsecure && config.turnstileBypassLocal) {
		violations.push(
			'TURNSTILE_BYPASS_LOCAL is true on a public https origin — Turnstile would be fully bypassed. Set it to false in production.',
		);
	}
	if (!demoInsecure && !config.requireEmailVerification) {
		violations.push(
			'AUTH_REQUIRE_EMAIL_VERIFICATION is false on a public https origin — accounts would be confirmed without email verification. Enable it in production.',
		);
	}
	if (!demoInsecure && !config.turnstileSecret) {
		violations.push('TURNSTILE_SECRET_KEY is missing — Turnstile cannot be verified in production.');
	}
	if (Number(config.trustedProxyHops ?? 0) <= 0) {
		violations.push(
			'AUTH_TRUSTED_PROXY_HOPS must be >= 1 in production so the client IP is read from a trusted proxy hop; per-IP throttling is meaningless otherwise.',
		);
	}
	if (!config.serviceKey) {
		violations.push('SERVICE_ROLE_KEY is missing — privileged auth operations cannot run in production.');
	}
	return violations;
}

export function enforceStartupGuards(config, { logger = console, exit = (code) => process.exit(code) } = {}) {
	const violations = collectStartupViolations(config);
	if (violations.length === 0) return true;
	logger.error('[auth-gateway] FATAL: refusing to start with an insecure production configuration:');
	for (const violation of violations) logger.error(`  - ${violation}`);
	logger.error('[auth-gateway] Fix the configuration above or run against a local/non-https origin for development.');
	exit(1);
	return false;
}
