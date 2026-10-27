/* The page GoTrue returns to after a provider sign-in: /auth/callback?code=... The code is
   swapped for an osionos session by the gateway, with the PKCE verifier this tab stored when
   the flow started. The query is stripped from the address bar before any request. */

import { isTrustedOsionosRedirect } from '../lib/osionos-redirect';
import { OAUTH_PENDING_KEY, type PendingOAuthFlow } from './portal-oauth';

const FLOW_TTL_MS = 10 * 60 * 1000;

const ERROR_MESSAGES: Record<string, string> = {
	oauth_email_collision: 'This email already has a Prismatica account. Sign in with your password instead.',
	oauth_provider_unavailable: 'Sign-in with this provider is not available right now.',
	oauth_unsafe_config: 'Sign-in with a provider is not available right now.',
	oauth_invalid_request: 'This sign-in attempt was not valid. Try again from the sign-in window.',
	oauth_requires_password_login: 'Sign in with your email and password instead.',
	provider_email_needs_verification: 'Verify your email with the provider first, then try again.',
	access_denied: 'Sign-in was cancelled at the provider.',
	rate_limited: 'Too many attempts. Wait a minute and try again.',
};

export type CallbackOutcome = { kind: 'redirect'; url: string } | { kind: 'error'; message: string };

type LocationLike = Pick<Location, 'pathname' | 'search'>;
type HistoryLike = Pick<History, 'state' | 'replaceState'>;

function messageFor(code: string | undefined, fallback: string): string {
	return (code && ERROR_MESSAGES[code]) || fallback;
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
	const code = params.get('code');
	if (!code) return { kind: 'error', message: messageFor(params.get('error_code') ?? params.get('error') ?? undefined, 'Sign-in was refused by the provider.') };
	if (!pending) return { kind: 'error', message: 'This sign-in attempt expired or was already used. Try again from the sign-in window.' };
	try {
		const response = await fetchImpl(`${gatewayUrl}/oauth-session`, {
			method: 'POST',
			headers: { accept: 'application/json', 'content-type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ code, verifier: pending.verifier }),
		});
		const body = (await response.json().catch(() => ({}))) as { error?: string; redirectUrl?: string };
		if (!response.ok) return { kind: 'error', message: messageFor(body.error, 'Could not complete sign-in. Try again.') };
		if (typeof body.redirectUrl !== 'string' || !isTrustedOsionosRedirect(body.redirectUrl)) {
			return { kind: 'error', message: 'Workspace redirect blocked: the link did not match the osionos app.' };
		}
		return { kind: 'redirect', url: body.redirectUrl };
	} catch {
		return { kind: 'error', message: 'The sign-in service did not answer. Try again in a minute.' };
	}
}
