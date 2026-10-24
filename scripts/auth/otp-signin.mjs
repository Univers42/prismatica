/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   otp-signin.mjs                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/24 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/24 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

/**
 * Sign in with an emailed 6-digit code, no password. The code is held here, in the gateway: it
 * is issued only for an address that has a confirmed GoTrue user, stored only as an HMAC (pepper
 * derived from the link-signing key), valid CODE_TTL_SEC, single use, and checked here, never by
 * GoTrue. A right code is then traded for a session: generate_link (magiclink) -> verify, the
 * same hashed_token path the site's own links use, and the answer is the password login's:
 * sanitized body plus the refresh token for the cookie.
 *
 * Every refusal is one answer (`SIGNIN_CODE_INVALID`), so the response never says whether the
 * address exists, the code was wrong, spent, expired or locked. The attempt counters are bumped
 * BEFORE the comparison: 5 tries per code (a new request makes a new code and a new counter) and
 * 5 per address per ADDRESS_WINDOW_SEC (a new request does not reset it). Past either, the code is deleted.
 *
 * Caveat: the user lookup (GoTrue admin list + exact compare) and `verify(magiclink)` are
 * checked against a fake only; whether the real GoTrue honours the `filter` and yields a session
 * is verified on the live stack. The 1-in-a-million blind guess is bounded by the caps, not
 * removed. With the memory store a restart drops codes and counters together (a code can only
 * die early). A caller who knows an address can burn its 5 address tries and lock it for ADDRESS_WINDOW_SEC.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { bumpCounter, claimOnce, CODE_TTL_SEC, hashCode, isLoginCode, MAX_WRONG_CODES, sameCode } from './code-custody.mjs';
import { tokenHashFrom } from './account-mail.mjs';
import { EMAIL_REGEX, keyHash, normalizeEmail } from './identity.mjs';

export const SIGNIN_CODE_INVALID = Object.freeze({ error: 'signin_code_invalid', message: 'That code is not right or has expired. Request a new one.' });
const INFO = 'prismatica-signin-code-v1';
const MAX_EMAIL_LENGTH = 254;
// The address budget outlives any one code: 3 code requests/h x 5 tries would otherwise renew it
// every CODE_TTL_SEC. A new request neither resets nor shortens this window.
const ADDRESS_WINDOW_SEC = 3600;

const recordKey = (email) => `signin-code:${keyHash(email)}`;
const addressKey = (email) => `signin-code:addr:${keyHash(email)}`;
const decoyKey = (email, kind) => `signin-code:decoy:${kind}:${keyHash(email)}`;
const triesKey = (email, generation) => `signin-code:tries:${keyHash(email)}:${generation}`;
const usedKey = (email, generation) => `signin-code:used:${keyHash(email)}:${generation}`;

/** The address in canonical form, or '' when it cannot be one. */
export function signInAddress(raw) {
	const email = normalizeEmail(raw);
	return email.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(email) ? email : '';
}

export function createOtpSignin({ store, gotrue, signingKey, audit }) {
	const refuse = (reason, email) => {
		audit('signin_code_refused', { email, reason });
		return { status: 401, body: SIGNIN_CODE_INVALID };
	};

	/** The plain code for `email`, stored hashed; '' when the address has no confirmed user. */
	async function issue(email) {
		if (!signingKey || !(await gotrue.findUserByEmail(email))) return '';
		const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
		const generation = randomBytes(8).toString('hex');
		await store.set(recordKey(email), `${generation}.${hashCode({ signingKey, info: INFO, email, code })}`, CODE_TTL_SEC);
		return code;
	}

	async function session(email) {
		if (!(await gotrue.findUserByEmail(email))) return undefined;
		const link = await gotrue.generateLink({ type: 'magiclink', email });
		const tokenHash = link.ok ? tokenHashFrom(link.body) : '';
		const result = tokenHash ? await gotrue.verify('magiclink', tokenHash) : undefined;
		const granted = result?.ok && typeof result.body.access_token === 'string' && normalizeEmail(result.body.user?.email) === email;
		return granted ? result.body : undefined;
	}

	/** @returns {Promise<{status: number, body: object, refreshToken?: string, email?: string}>} */
	async function verify(rawEmail, rawCode) {
		const email = signInAddress(rawEmail);
		if (!email || !isLoginCode(rawCode) || !signingKey) return { status: 401, body: SIGNIN_CODE_INVALID };
		const stored = await store.get(recordKey(email));
		if (!stored) {
			// Same store round trips and one hash as a wrong guess, so latency does not say whether a code is pending.
			await bumpCounter(store, decoyKey(email, 'addr'), CODE_TTL_SEC);
			await bumpCounter(store, decoyKey(email, 'tries'), CODE_TTL_SEC);
			hashCode({ signingKey, info: INFO, email, code: rawCode });
			return refuse('no_code', email);
		}
		const [generation, expected] = stored.split('.');
		const addressTries = await bumpCounter(store, addressKey(email), ADDRESS_WINDOW_SEC);
		const codeTries = await bumpCounter(store, triesKey(email, generation), CODE_TTL_SEC);
		if (addressTries > MAX_WRONG_CODES || codeTries > MAX_WRONG_CODES) {
			await store.del(recordKey(email));
			return refuse('locked', email);
		}
		if (!sameCode(expected, hashCode({ signingKey, info: INFO, email, code: rawCode }))) {
			if (addressTries >= MAX_WRONG_CODES || codeTries >= MAX_WRONG_CODES) await store.del(recordKey(email));
			return refuse('wrong_code', email);
		}
		if (!(await claimOnce(store, usedKey(email, generation), CODE_TTL_SEC))) return refuse('spent', email);
		await store.del(recordKey(email));
		const granted = await session(email);
		if (!granted) return refuse('no_session', email);
		await store.del(addressKey(email));
		audit('signin_code_verified', { email });
		const refreshToken = typeof granted.refresh_token === 'string' ? granted.refresh_token : '';
		const body = { ...granted };
		delete body.refresh_token;
		return { status: 200, body, refreshToken, email };
	}

	return { issue, verify };
}
