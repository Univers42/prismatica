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

// Trusted client-IP derivation.
//
// THREAT (HIGH): the previous implementation took the LEFT-most value of
// `x-forwarded-for`. Our reverse proxies (local-https-proxy, the website
// nginx) APPEND to XFF with `$proxy_add_x_forwarded_for`, so the left-most
// entry is whatever the *client* sent — fully attacker-controlled. Rotating
// `X-Forwarded-For: <random>` per request lands every request in a fresh
// rate-limit bucket and defeats ALL per-IP throttling (brute force, spam,
// memory growth).
//
// FIX: trust only the hops WE control. Each trusted reverse proxy appends the
// address of its own direct peer, so the right-most `trustedProxyHops` entries
// are trustworthy. The entry immediately before them is the IP the outermost
// trusted proxy observed = the real client. Counting from the RIGHT by a fixed
// hop count is immune to client-side XFF prepending (extra spoofed entries only
// grow the left side, never shifting the trusted tail).

export function normalizeIp(value) {
	let ip = String(value ?? '').trim().toLowerCase();
	if (!ip) return '';
	// IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) -> 127.0.0.1
	if (ip.startsWith('::ffff:')) ip = ip.slice(7);
	// strip a trailing :port from bare IPv4 (1.2.3.4:5678 -> 1.2.3.4); leave IPv6 alone
	if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
	return ip;
}

export function forwardedChain(headerValue) {
	const raw = Array.isArray(headerValue) ? headerValue.join(',') : headerValue ?? '';
	return String(raw)
		.split(',')
		.map((part) => normalizeIp(part))
		.filter(Boolean);
}

// options: { trustedProxyHops, trustCfConnectingIp }
export function deriveClientIp(request, options = {}) {
	const trustedProxyHops = Number(options.trustedProxyHops ?? 0);
	const trustCfConnectingIp = options.trustCfConnectingIp === true;
	const remote = normalizeIp(request?.socket?.remoteAddress ?? '');

	// Only trust Cloudflare's header when we KNOW Cloudflare fronts the origin
	// (and the origin only accepts Cloudflare IPs). Off by default.
	if (trustCfConnectingIp) {
		const cf = request?.headers?.['cf-connecting-ip'];
		const cfIp = normalizeIp(Array.isArray(cf) ? cf[0] : cf);
		if (cfIp) return cfIp;
	}

	// No trusted proxy in front -> the socket peer IS the client. Never trust XFF.
	if (trustedProxyHops <= 0) return remote || 'unknown';

	const chain = forwardedChain(request?.headers?.['x-forwarded-for']);
	if (chain.length === 0) return remote || 'unknown';

	const index = chain.length - trustedProxyHops;
	// Chain shorter than the configured hop count (mis-set or a request that
	// skipped a proxy): fall back to the left-most we have rather than to a
	// value an attacker could have appended. This over-throttles a shared
	// upstream at worst — fail safe, never fail open.
	if (index < 0) return chain[0];
	return chain[index] ?? remote ?? 'unknown';
}
