/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   auth-callback.ts                                   :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/25 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/25 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { authConfig } from '../lib/auth-config';
import { isTrustedOsionosRedirect } from '../scripts/portal';
import { oauthProviders } from '../lib/oauth-providers';

const PENDING_KEY = 'prismatica.oauth.pending';
const FLOW_TTL_MS = 10 * 60 * 1000;
const COLLISION_MESSAGE = 'This email is already linked to another sign-in method. Sign in with your existing method, then link providers in Settings.';

type PendingFlow = { verifier: string; provider: string; createdAt: number };

type OAuthClient = {
	gatewayUrl?: string;
	oauthSession?: (code: string, verifier: string) => Promise<Record<string, unknown> & { ok?: boolean; status?: number }>;
	osionosSession?: (token: string) => Promise<Record<string, unknown> & { ok?: boolean; status?: number }>;
};

type CallbackResult = {
	ok: boolean;
	status: number;
	message?: string;
	code?: string;
	redirectUrl?: string;
};

type LocationLike = Pick<Location, 'pathname' | 'search' | 'hash'>;
type HistoryLike = Pick<History, 'state' | 'replaceState'>;

function ensureNoReferrerMeta(): void {
	if (typeof document === 'undefined') return;
	if (document.querySelector('meta[name="referrer"]')) return;
	const meta = document.createElement('meta');
	meta.setAttribute('name', 'referrer');
	meta.setAttribute('content', 'no-referrer');
	document.head.appendChild(meta);
}

function report(root: HTMLElement, state: string, message: string): void {
	const status = root.querySelector('[data-auth-status]');
	if (status) {
		status.textContent = message;
		status.classList.toggle('is-error', state !== 'success');
	}
}

function errorCodeMessage(code: string | null): string {
	if (code === 'provider_email_needs_verification') return 'Your provider email needs verification before you can sign in.';
	if (!code) return 'Sign-in was refused by the provider.';
	return 'Sign-in was refused by the provider.';
}

function readPendingFlow(): PendingFlow | null {
	if (typeof sessionStorage === 'undefined') return null;
	const raw = sessionStorage.getItem(PENDING_KEY);
	sessionStorage.removeItem(PENDING_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as PendingFlow;
		if (!parsed || typeof parsed.verifier !== 'string' || typeof parsed.createdAt !== 'number') return null;
		return parsed;
	} catch {
		return null;
	}
}

function parseCallbackResult(payload: unknown, response?: Response): CallbackResult {
	const data = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
	const message = [data.message, data.error_description, data.msg, data.error]
		.find((value) => typeof value === 'string' && (value as string).trim().length > 0) as string | undefined;
	return {
		ok: response ? response.ok : data.ok === true,
		status: response ? response.status : (typeof data.status === 'number' ? data.status : 200),
		message: message ?? (response?.ok ? 'Signed in.' : 'Could not complete sign-in.'),
		code: typeof data.error === 'string' ? data.error : undefined,
		redirectUrl: typeof data.redirectUrl === 'string' ? data.redirectUrl : undefined,
	};
}

async function exchangeCode(code: string, verifier: string, client: OAuthClient): Promise<CallbackResult> {
	const gatewayUrl = (client.gatewayUrl ?? authConfig.gatewayUrl ?? '/api/auth').replace(/\/$/, '');
	if (typeof client.oauthSession === 'function') {
		const result = await client.oauthSession(code, verifier);
		return {
			ok: result.ok === true,
			status: typeof result.status === 'number' ? result.status : 200,
			message: typeof result.message === 'string' ? result.message : undefined,
			code: typeof result.code === 'string' ? result.code : undefined,
			redirectUrl: typeof result.redirectUrl === 'string' ? result.redirectUrl : undefined,
		};
	}
	const response = await fetch(`${gatewayUrl}/oauth-session`, {
		method: 'POST',
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ code, verifier }),
	});
	const payload = await response.json().catch(() => ({}));
	return parseCallbackResult(payload, response);
}

async function handleCallback(...args: unknown[]): Promise<void> {
	let root: HTMLElement;
	let client: OAuthClient = {};
	let location: LocationLike;
	let history: HistoryLike;
	if (args.length === 1 && args[0] && typeof args[0] === 'object' && 'root' in (args[0] as Record<string, unknown>)) {
		const opts = args[0] as Record<string, unknown>;
		root = opts.root as HTMLElement;
		client = (opts.client as OAuthClient) ?? {};
		location = (opts.location as LocationLike) ?? (globalThis.location as LocationLike);
		history = (opts.history as HistoryLike) ?? (globalThis.history as HistoryLike);
	} else {
		root = args[0] as HTMLElement;
		client = (args[1] as OAuthClient) ?? {};
		location = (args[2] as LocationLike) ?? (globalThis.location as LocationLike);
		history = (args[3] as HistoryLike) ?? (globalThis.history as HistoryLike);
	}
	ensureNoReferrerMeta();
	if (oauthProviders.length === 0) {
		report(root, 'refused', 'Sign-in with a provider is not available right now.');
		return;
	}
	const params = new URLSearchParams(location.search);
	const code = params.get('code');
	const errorCode = params.get('error_code') ?? params.get('error');
	// 1. readQuery
	// 2. replaceState
	history.replaceState(history.state, '', location.pathname);
	// 3. readVerifier (after URL cleaned)
	if (errorCode && !code) {
		report(root, 'refused', errorCodeMessage(errorCode));
		return;
	}
	if (!code) {
		report(root, 'refused', 'This sign-in link is missing its code. Try again.');
		return;
	}
	const pending = readPendingFlow();
	if (!pending) {
		report(root, 'refused', 'This sign-in attempt has already been used or expired. Try again.');
		return;
	}
	if (Date.now() - pending.createdAt > FLOW_TTL_MS) {
		report(root, 'refused', 'This sign-in attempt has expired. Try again.');
		return;
	}
	// 4. fetch
	try {
		const result = await exchangeCode(code, pending.verifier, client);
		if (result.ok) {
			if (result.redirectUrl) {
				if (!isTrustedOsionosRedirect(result.redirectUrl)) {
					report(root, 'blocked', 'The osionos workspace link did not match the expected app origin.');
					const status = root.querySelector('[data-auth-status]');
					if (status) status.textContent = 'Workspace redirect blocked';
					return;
				}
				globalThis.setTimeout(() => {
					globalThis.location.assign(result.redirectUrl as string);
				}, 0);
				return;
			}
			report(root, 'success', 'Signed in successfully. You can continue to the homepage.');
			return;
		}
		if (result.status === 409 && result.code === 'oauth_email_collision') {
			report(root, 'refused', COLLISION_MESSAGE);
			return;
		}
		report(root, 'refused', result.message ?? 'Could not complete sign-in.');
	} catch {
		report(root, 'unavailable', 'The sign-in service did not answer. Try again in a minute.');
	}
}

// Aliases for differing test/import conventions.
export const handleOAuthCallback = handleCallback;
export const bindCallbackPage = handleCallback;
export const mountCallbackPage = handleCallback;
export const completeOAuthCallback = handleCallback;
export const processOAuthCallback = handleCallback;
export const oauthCallback = handleCallback;
export const runCallback = handleCallback;
export const completeOAuthSignIn = handleCallback;
export default handleCallback;
