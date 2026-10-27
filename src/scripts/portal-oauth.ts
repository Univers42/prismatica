/* Provider sign-in on the portal. grobase decides which providers exist (GoTrue /settings, read
   through the gateway), so the buttons stay hidden until the gateway lists one. The PKCE verifier
   stays in this tab's sessionStorage; only its S256 challenge leaves the browser. */

export type OAuthProvider = 'google' | 'github';

const PROVIDER_LABELS: Record<OAuthProvider, string> = { google: 'Google', github: 'GitHub' };

export const OAUTH_PENDING_KEY = 'prismatica.oauth.pending';

export type PendingOAuthFlow = { verifier: string; provider: OAuthProvider; createdAt: number };

export function oauthMarkup(): string {
	return `
		<div class="portal-oauth" data-oauth-providers hidden>
			<div class="portal-oauth__buttons" data-oauth-buttons></div>
			<p class="portal-oauth__terms">By continuing with a provider you agree to the <a href="/legal/terms/" target="_blank" rel="noopener">Terms</a> and <a href="/legal/privacy-policy/" target="_blank" rel="noopener">Privacy Policy</a>.</p>
			<p class="portal-oauth__divider"><span>or with email</span></p>
		</div>
	`;
}

function isProvider(value: unknown): value is OAuthProvider {
	return typeof value === 'string' && Object.hasOwn(PROVIDER_LABELS, value);
}

// The callback only returns to the gateway's own site, so any other origin (the beta) offers none.
export async function fetchOAuthProviders(gatewayUrl: string, origin: string, fetchImpl: typeof fetch = fetch): Promise<OAuthProvider[]> {
	try {
		const response = await fetchImpl(`${gatewayUrl}/oauth/providers`, { headers: { accept: 'application/json' } });
		if (!response.ok) return [];
		const body = (await response.json()) as { providers?: unknown; origin?: unknown };
		if (body.origin !== origin || !Array.isArray(body.providers)) return [];
		return body.providers.filter(isProvider);
	} catch {
		return [];
	}
}

export function base64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
	const verifier = base64Url(globalThis.crypto.getRandomValues(new Uint8Array(32)));
	const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export async function startOAuthSignIn(provider: OAuthProvider, gatewayUrl: string, storage: Storage, assign: (url: string) => void): Promise<void> {
	const { verifier, challenge } = await createPkcePair();
	const pending: PendingOAuthFlow = { verifier, provider, createdAt: Date.now() };
	storage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pending));
	const query = new URLSearchParams({ provider, code_challenge: challenge });
	assign(`${gatewayUrl}/oauth/authorize?${query}`);
}

export async function bindPortalOAuth(portal: HTMLElement, gatewayUrl: string): Promise<void> {
	const container = portal.querySelector<HTMLElement>('[data-oauth-providers]');
	const buttons = portal.querySelector<HTMLElement>('[data-oauth-buttons]');
	if (!container || !buttons) return;
	const providers = await fetchOAuthProviders(gatewayUrl, globalThis.location.origin);
	if (providers.length === 0) return;
	for (const provider of providers) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'portal-secondary portal-oauth__button';
		button.dataset.oauthProvider = provider;
		button.textContent = `Continue with ${PROVIDER_LABELS[provider]}`;
		button.addEventListener('click', () => {
			button.disabled = true;
			startOAuthSignIn(provider, gatewayUrl, globalThis.sessionStorage, (url) => globalThis.location.assign(url)).catch(() => {
				button.disabled = false;
			});
		});
		buttons.append(button);
	}
	container.hidden = false;
}
