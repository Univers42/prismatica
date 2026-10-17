/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   mail-daily-cap.mjs                           :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */


// A ceiling on mails the gateway sends per UTC day (AUTH_MAIL_DAILY_CAP, verdict SGN-5).
//
// Every gateway mail leaves through one Titan mailbox; its provider suspends a mailbox that
// bursts past its daily quota, which would silence verification and recovery for everyone.
// The cap is the gateway's own fuse, set below that quota.
//
// Caveat: the count lives in the gateway's store. The in-memory store resets on a restart (a
// crash loop re-grants the whole cap) and is per process, so two replicas allow twice the
// cap; Redis (REDIS_URL) fixes both. The day rolls at 00:00 UTC, not in the mailbox's zone.
// An attempt is counted, not a delivery: a send that then fails still used its slot. Only the
// mailer is covered; the emailed login code is sent by grobase and is bounded there.

const DEFAULT_PRODUCTION_CAP = 200;
const COUNTER_TTL_SEC = 25 * 3600;

// A public origin has no 'no cap' value: unset, 0 and garbage all fall back to the default.
export function resolveMailDailyCap(raw, isProduction) {
	const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
	if (Number.isFinite(parsed) && parsed > 0) return parsed;
	return isProduction ? DEFAULT_PRODUCTION_CAP : 0;
}

/** `take()` resolves true while the day's cap has room; a cap of 0 never refuses. */
export function createMailDailyCap({ store, cap, now = () => new Date(), logger = { warn: (message) => console.warn(message) } }) {
	return {
		async take() {
			if (!(cap > 0)) return true;
			const day = now().toISOString().slice(0, 10);
			const count = await store.incrWithTtl(`mail-daily:${day}`, COUNTER_TTL_SEC);
			if (count <= cap) return true;
			if (count === cap + 1) logger.warn(`[auth-gateway] daily mail cap of ${cap} reached for ${day} (UTC): further mail is refused until it rolls over.`);
			return false;
		},
	};
}
