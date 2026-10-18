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

import { parseSignupAllowlist } from './signup-allowlist.mjs';

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

const DUMMY_TURNSTILE_SECRET = /^[123]x0{20,}/;

export const SIGNUP_OPEN_MAX_DAILY_MAIL = 50;
export const SIGNUP_OPEN_MAX_REGISTER_PER_HOUR = 10;

// AUTH_SIGNUP_OPEN replaces the allowlist with proof of address ownership: the only mail an
// open form can cause goes to the address typed, so the controls below are what bound the damage.
// A valid AUTH_LINK_SIGNING_KEY is also required, but that violation is raised for every public origin.
// Caveat: this checks that each control is configured, not that it works; a Redis-less store
// resets the daily cap on restart, and the register limit is per client IP (a /64 for IPv6).
function signupOpenProblems(config) {
	const problems = [];
	if (config.demoInsecure === true) problems.push('AUTH_SIGNUP_OPEN cannot be combined with AUTH_DEMO_INSECURE=true — the demo relaxation removes the email proof it relies on.');
	if (!config.requireEmailVerification) problems.push('AUTH_SIGNUP_OPEN requires AUTH_REQUIRE_EMAIL_VERIFICATION to be on — open signup is only safe when email proves ownership.');
	const cap = Number(config.mailDailyCap);
	if (!(cap > 0 && cap <= SIGNUP_OPEN_MAX_DAILY_MAIL)) {
		problems.push(`AUTH_SIGNUP_OPEN requires AUTH_MAIL_DAILY_CAP to be set to ${SIGNUP_OPEN_MAX_DAILY_MAIL} or less (got ${config.mailDailyCap ?? 'unset'}).`);
	}
	const registerLimit = Number(config.registerHourlyLimit);
	if (!(registerLimit > 0 && registerLimit <= SIGNUP_OPEN_MAX_REGISTER_PER_HOUR)) {
		problems.push(`AUTH_SIGNUP_OPEN requires AUTH_REGISTER_RATE_LIMIT_PER_HOUR between 1 and ${SIGNUP_OPEN_MAX_REGISTER_PER_HOUR} (got ${config.registerHourlyLimit ?? 'unset'}).`);
	}
	return problems;
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
	// AUTH_TURNSTILE_OPTIONAL: the osionos bridge's login proxy sends a fixed token, so a deploy
	// without a secret must still boot. TURNSTILE_BYPASS_LOCAL above is not relaxed by it.
	if (!demoInsecure && !config.turnstileSecret && config.turnstileOptional !== true) {
		violations.push('TURNSTILE_SECRET_KEY is missing — Turnstile cannot be verified in production.');
	}
	// Cloudflare's published test secrets (1x/2x/3x + zeros) always pass or always fail, so a copy
	// in a public deploy silently disables the CAPTCHA. Caveat: shape match only; the gateway never
	// reads the site key (it lives in the site build), so a dummy site key is not detectable here.
	if (!demoInsecure && DUMMY_TURNSTILE_SECRET.test(config.turnstileSecret ?? '')) {
		violations.push(
			'TURNSTILE_SECRET_KEY is a Cloudflare dummy test key — it makes Turnstile always pass or always fail. Create a real widget at dash.cloudflare.com → Turnstile for the site hostname and use its secret.',
		);
	}
	if (Number(config.trustedProxyHops ?? 0) <= 0) {
		violations.push(
			'AUTH_TRUSTED_PROXY_HOPS must be >= 1 in production so the client IP is read from a trusted proxy hop; per-IP throttling is meaningless otherwise.',
		);
	}
	if (!config.serviceKey) {
		violations.push('SERVICE_ROLE_KEY is missing — privileged auth operations cannot run in production.');
	}
	// Fail closed and not relaxed by demoInsecure: an empty list on a public origin is open signup,
	// and every signup sends mail from the shared mailbox (verdict SGN-1).
	if (config.signupOpen === true) violations.push(...signupOpenProblems(config));
	else if (parseSignupAllowlist(config.signupAllowlist).isEmpty) {
		violations.push('AUTH_SIGNUP_ALLOWLIST is empty on a public https origin — anyone could trigger signup mail. List the allowed addresses or domains.');
	}
	// Verification and reset links are signed with this key (verdict B, C1); without it
	// no account e-mail can be sent, so production refuses to boot rather than degrade.
	if (config.linkSigningKeyProblem) {
		violations.push(`${config.linkSigningKeyProblem} Set a dedicated AUTH_LINK_SIGNING_KEY of at least 32 characters.`);
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
