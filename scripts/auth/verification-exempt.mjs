/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   verification-exempt.mjs                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Accounts that may sign in without the gateway ever mailing them (AUTH_VERIFICATION_EXEMPT):
// test and demo accounts on addresses the operator does not own. Exact addresses only; no
// domain, no wildcard. The one suppression point is the gateway's sendMail.
//
// Caveat: this stops the GATEWAY's mail only. baas /auth/v1/recover and /otp are public with the
// anon key and GoTrue mails through its own SMTP, so an exempt account belongs to whoever reads
// its inbox: never admin, nothing private in it. Moving the account to an address the operator
// owns is the better fix. Matching is on the lowercased address, so a plus-tag or a dot variant
// of a listed Gmail address is a different, non-exempt address.
import { EMAIL_REGEX } from './identity.mjs';

export const MAX_EXEMPT_ENTRIES = 10;
const ENV_NAME = 'AUTH_VERIFICATION_EXEMPT';

function entryProblem(entry) {
	if (entry.startsWith('@')) return `${ENV_NAME} entry "${entry}" is a domain; list exact addresses only.`;
	if (entry.includes('*')) return `${ENV_NAME} entry "${entry}" contains a wildcard; list exact addresses only.`;
	if (entry.includes('"')) return `${ENV_NAME} entry "${entry}" has a quoted local part, which is not accepted.`;
	if (!EMAIL_REGEX.test(entry)) return `${ENV_NAME} entry "${entry}" is not a valid email address.`;
	return '';
}

/** @returns {{addresses: Set<string>, problems: string[]}} problems is empty when the list may boot. */
export function parseVerificationExempt(raw, { loginEmailOtp = false } = {}) {
	const entries = String(raw ?? '').toLowerCase().split(/[,\s]+/).filter(Boolean);
	const problems = entries.map(entryProblem).filter(Boolean);
	if (entries.length > MAX_EXEMPT_ENTRIES) problems.push(`${ENV_NAME} lists ${entries.length} addresses; the limit is ${MAX_EXEMPT_ENTRIES}.`);
	// The emailed sign-in code comes from grobase's code service, not sendMail, so it cannot be
	// suppressed; skipping it for listed accounts would be a second-factor bypass list.
	if (entries.length > 0 && loginEmailOtp) problems.push(`${ENV_NAME} cannot be combined with AUTH_LOGIN_EMAIL_OTP=true: the emailed code cannot be suppressed.`);
	return { addresses: new Set(entries), problems };
}

export function isVerificationExempt(addresses, email) {
	return addresses.has(String(email ?? '').trim().toLowerCase());
}

/** Wraps a mail sender: an exempt recipient gets no mail, one audit event (address only, no body). */
export function withExemptSuppression(addresses, send, audit) {
	return (message) => {
		if (!isVerificationExempt(addresses, message.to)) return send(message);
		audit('mail_suppressed_exempt', { email: String(message.to).trim().toLowerCase() });
		return Promise.resolve({ suppressed: true });
	};
}
