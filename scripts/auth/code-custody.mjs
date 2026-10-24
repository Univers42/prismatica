/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   code-custody.mjs                                   :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/24 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/24 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

/**
 * The primitives that keep a 6-digit sign-in code safe, shared by the emailed login code step
 * (login-otp.mjs) and the passwordless code sign-in (otp-signin.mjs): the lifetime, the wrong-guess
 * cap, the single-use claim and the peppered hash. One copy, so the two flows cannot drift apart.
 *
 * Caveat: counters live in the store they are given. With the memory store a gateway restart resets
 * them and a code kept in the same store dies with them, so a restart can only shorten a code's
 * life, never lengthen it. The per-address cap lets someone who knows an address lock that
 * address's code sign-in for CODE_TTL_SEC (the same trade-off as password recovery, stated).
 */
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { keyHash, normalizeEmail } from './identity.mjs';

export const CODE_TTL_SEC = 600;
export const MAX_WRONG_CODES = 5;
const CODE = /^\d{6}$/;

export function isLoginCode(value) {
	return typeof value === 'string' && CODE.test(value);
}

/** Counts one more wrong guess under `key`; the window starts at the first one. Returns the new count. */
export function bumpCounter(store, key, ttlSec) {
	return store.incrWithTtl(key, ttlSec);
}

/** True for exactly one caller per `key` and window: the first to claim wins, every later claim loses. */
export async function claimOnce(store, key, ttlSec) {
	return (await store.incrWithTtl(key, ttlSec)) === 1;
}

/** HMAC-SHA256 hex of "<keyHash(email)>:<code>" under a pepper derived from the signing key and `info`. */
export function hashCode({ signingKey, info, email, code }) {
	const pepper = Buffer.from(hkdfSync('sha256', signingKey, '', info, 32));
	return createHmac('sha256', pepper).update(`${keyHash(normalizeEmail(email))}:${code}`).digest('hex');
}

/** Timing-safe equality of two hashCode results. */
export function sameCode(expected, actual) {
	const [a, b] = [Buffer.from(String(expected)), Buffer.from(String(actual))];
	return a.length === b.length && timingSafeEqual(a, b);
}
