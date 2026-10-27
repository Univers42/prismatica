/**
 * Which OAuth providers the site offers, and where the browser starts one.
 * grobase owns the provider keys and the enable flags (GOOGLE_OAUTH_ENABLED, ...); GoTrue
 * publishes them on /auth/v1/settings, so the site carries neither keys nor a provider list.
 */
export const OAUTH_PROVIDERS = ['google', 'github'];

const PROVIDER_SCOPES = { github: 'read:user user:email' };
const S256_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

// Empty while autoconfirm is on: then an OAuth sign-up can claim an unverified password account (F1).
export function enabledOauthProviders(settings) {
	if (settings?.mailer_autoconfirm !== false) return [];
	const external = settings.external ?? {};
	return OAUTH_PROVIDERS.filter((name) => external[name] === true);
}

export function isS256Challenge(value) {
	return typeof value === 'string' && S256_CHALLENGE.test(value);
}

// The anon key rides in the query because a browser redirect cannot send the apikey header.
export function oauthAuthorizeUrl({ siteUrl, anonKey, provider, codeChallenge }) {
	const base = String(siteUrl).replace(/\/+$/, '');
	const query = new URLSearchParams({
		provider,
		apikey: anonKey,
		redirect_to: `${base}/auth/callback`,
		code_challenge: codeChallenge,
		code_challenge_method: 's256',
	});
	if (PROVIDER_SCOPES[provider]) query.set('scopes', PROVIDER_SCOPES[provider]);
	return `${base}/auth/v1/authorize?${query}`;
}
