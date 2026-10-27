/* The page GoTrue returns to after a provider sign-in: /auth/callback?code=... The code is
   swapped for an osionos session by the gateway, with the PKCE verifier this tab stored when
   the flow started. The query is stripped from the address bar before any request. */

import { isTrustedOsionosRedirect } from '../lib/osionos-redirect';
import { OAUTH_PENDING_KEY, type OAuthProvider, type PendingOAuthFlow } from './portal-oauth';

const FLOW_TTL_MS = 10 * 60 * 1000;

export type CallbackProblem =
	| 'cancelled'
	| 'email_in_use'
	| 'email_unverified'
	| 'expired'
	| 'rate_limited'
	| 'unavailable'
	| 'password_only'
	| 'service_down'
	| 'redirect_blocked'
	| 'failed';

// Codes from the provider (via GoTrue's redirect) and from the gateway. Anything unlisted is 'failed'.
const PROBLEM_BY_CODE: Record<string, CallbackProblem> = {
	access_denied: 'cancelled',
	oauth_email_collision: 'email_in_use',
	provider_email_needs_verification: 'email_unverified',
	email_not_confirmed: 'email_unverified',
	bad_oauth_state: 'expired',
	flow_state_expired: 'expired',
	flow_state_not_found: 'expired',
	oauth_flow_missing: 'expired',
	rate_limited: 'rate_limited',
	over_request_rate_limit: 'rate_limited',
	oauth_provider_unavailable: 'unavailable',
	oauth_unsafe_config: 'unavailable',
	provider_disabled: 'unavailable',
	oauth_requires_password_login: 'password_only',
	oauth_upstream_failed: 'service_down',
	oauth_network_failed: 'service_down',
	oauth_redirect_blocked: 'redirect_blocked',
};

export type CallbackOutcome =
	| { kind: 'redirect'; url: string }
	| { kind: 'error'; problem: CallbackProblem; code: string; provider: OAuthProvider | null };

type LocationLike = Pick<Location, 'pathname' | 'search'>;
type HistoryLike = Pick<History, 'state' | 'replaceState'>;

// The code is shown to the user as a support reference, so only a plain token is echoed back.
function safeCode(code: string | null | undefined): string {
	return code && /^[a-z0-9_]{1,64}$/.test(code) ? code : 'unknown_error';
}

function failure(code: string | null | undefined, provider: OAuthProvider | null): CallbackOutcome {
	const reference = safeCode(code);
	return { kind: 'error', problem: PROBLEM_BY_CODE[reference] ?? 'failed', code: reference, provider };
}

// One read per flow: the entry is removed before it is parsed, so a replayed callback finds nothing.
export function takePendingFlow(storage: Storage, now = Date.now()): PendingOAuthFlow | null {
	const raw = storage.getItem(OAUTH_PENDING_KEY);
	storage.removeItem(OAUTH_PENDING_KEY);
	if (!raw) return null;
	try {
		const flow = JSON.parse(raw) as PendingOAuthFlow;
		if (typeof flow?.verifier !== 'string' || typeof flow.createdAt !== 'number') return null;
		return now - flow.createdAt <= FLOW_TTL_MS ? flow : null;
	} catch {
		return null;
	}
}

export async function completeOAuthCallback(
	gatewayUrl: string,
	location: LocationLike,
	history: HistoryLike,
	storage: Storage,
	fetchImpl: typeof fetch = fetch,
): Promise<CallbackOutcome> {
	const params = new URLSearchParams(location.search);
	history.replaceState(history.state, '', location.pathname);
	const pending = takePendingFlow(storage);
	const provider = pending?.provider ?? null;
	const code = params.get('code');
	// GoTrue sends error_code empty for some provider errors, so an empty value falls back to error.
	if (!code) return failure(params.get('error_code') || params.get('error'), provider);
	if (!pending) return failure('oauth_flow_missing', null);
	try {
		const response = await fetchImpl(`${gatewayUrl}/oauth-session`, {
			method: 'POST',
			headers: { accept: 'application/json', 'content-type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ code, verifier: pending.verifier }),
		});
		const body = (await response.json().catch(() => ({}))) as { error?: string; redirectUrl?: string };
		if (!response.ok) return failure(body.error ?? `http_${response.status}`, provider);
		if (typeof body.redirectUrl !== 'string' || !isTrustedOsionosRedirect(body.redirectUrl)) return failure('oauth_redirect_blocked', provider);
		return { kind: 'redirect', url: body.redirectUrl };
	} catch {
		return failure('oauth_network_failed', provider);
	}
}
