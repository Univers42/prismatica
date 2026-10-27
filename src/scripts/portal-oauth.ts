/* Provider sign-in on the portal. grobase decides which providers exist (GoTrue /settings, read
   through the gateway), so the buttons stay hidden until the gateway lists one. The PKCE verifier
   stays in this tab's sessionStorage; only its S256 challenge leaves the browser. */

export type OAuthProvider = 'google' | 'github';

type ProviderMark = { label: string; viewBox: string; paths: ReadonlyArray<readonly [d: string, fill: string]> };

// Logo-only buttons: the brand mark is what people recognise, the name lives in aria-label and in
// the hover/focus tooltip. Google's mark keeps its four brand colours (their guidelines forbid
// recolouring it); GitHub's follows the text colour so it stays visible in both themes.
const PROVIDER_MARKS: Record<OAuthProvider, ProviderMark> = {
	google: {
		label: 'Google',
		viewBox: '0 0 48 48',
		paths: [
			['M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z', '#EA4335'],
			['M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z', '#4285F4'],
			['M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z', '#FBBC05'],
			['M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z', '#34A853'],
		],
	},
	github: {
		label: 'GitHub',
		viewBox: '0 0 16 16',
		paths: [
			[
				'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z',
				'currentColor',
			],
		],
	},
};

const SVG_NS = 'http://www.w3.org/2000/svg';

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
	return typeof value === 'string' && Object.hasOwn(PROVIDER_MARKS, value);
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

// DOM nodes, not markup: the CSP requires Trusted Types, so innerHTML with an SVG string throws.
function providerLogo(mark: ProviderMark): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', mark.viewBox);
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('focusable', 'false');
	svg.classList.add('portal-oauth__logo');
	for (const [d, fill] of mark.paths) {
		const path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', d);
		path.setAttribute('fill', fill);
		svg.append(path);
	}
	return svg;
}

function providerButton(provider: OAuthProvider): HTMLButtonElement {
	const { label } = PROVIDER_MARKS[provider];
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'portal-secondary portal-oauth__button';
	button.dataset.oauthProvider = provider;
	button.setAttribute('aria-label', `Continue with ${label}`);
	const tooltip = document.createElement('span');
	tooltip.className = 'portal-oauth__tooltip';
	tooltip.id = `portal-oauth-tooltip-${provider}`;
	tooltip.setAttribute('role', 'tooltip');
	tooltip.textContent = `Sign in or create your account with ${label}`;
	button.setAttribute('aria-describedby', tooltip.id);
	button.append(providerLogo(PROVIDER_MARKS[provider]), tooltip);
	return button;
}

export async function bindPortalOAuth(portal: HTMLElement, gatewayUrl: string): Promise<void> {
	const container = portal.querySelector<HTMLElement>('[data-oauth-providers]');
	const buttons = portal.querySelector<HTMLElement>('[data-oauth-buttons]');
	if (!container || !buttons) return;
	const providers = await fetchOAuthProviders(gatewayUrl, globalThis.location.origin);
	if (providers.length === 0) return;
	for (const provider of providers) {
		const button = providerButton(provider);
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
