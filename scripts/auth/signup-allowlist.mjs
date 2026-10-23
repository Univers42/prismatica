/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   signup-allowlist.mjs                         :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */


// Who may start a signup or a newsletter subscription (AUTH_SIGNUP_ALLOWLIST, verdict SGN-1).
//
// Both flows make the gateway send mail from one shared mailbox, so an open form is a mail
// cannon. An entry with a local part (`a.b@x.com`) admits that exact address; `@x.com` or
// `x.com` admits that exact domain. There is no subdomain wildcard: `x.com` does not admit
// `mail.x.com`. Separate from AUTH_EMAIL_DOMAIN_ALLOWLIST, which only skips the MX lookup.
//
// An empty list admits everyone, so local dev and e2e are unchanged; guards.mjs refuses to
// boot a public origin with an empty list, which is what makes that default safe.
//
// Caveat: matching is on the literal address. `a+tag@x.com` is not `a@x.com`, and a Gmail
// dotted variant is a different address; list the exact form the colleague will type.

export function parseSignupAllowlist(raw) {
	const addresses = new Set();
	const domains = new Set();
	for (const entry of String(raw ?? '').toLowerCase().split(/[\s,]+/)) {
		if (!entry) continue;
		const at = entry.lastIndexOf('@');
		if (at > 0) addresses.add(entry);
		else domains.add(entry.slice(at + 1));
	}
	domains.delete('');
	return { addresses, domains, isEmpty: addresses.size === 0 && domains.size === 0 };
}

export function isSignupAllowed(allowlist, email) {
	if (allowlist.isEmpty) return true;
	const address = String(email ?? '').trim().toLowerCase();
	const at = address.lastIndexOf('@');
	return allowlist.addresses.has(address) || (at > 0 && allowlist.domains.has(address.slice(at + 1)));
}

// AUTH_SIGNUP_OPEN opens /register only, because an account mail goes to the address that typed
// it and is bounded by the daily cap. A newsletter confirmation is a mail to a third party the
// form cannot prove, so with no list it stays shut instead of falling back to "everyone".
export function isNewsletterAllowed(allowlist, email, signupOpen) {
	if (signupOpen && allowlist.isEmpty) return false;
	return isSignupAllowed(allowlist, email);
}
