/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   oauth-providers.ts                                 :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/25 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/25 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

export const OAUTH_PROVIDERS = ['google', 'github', 'fortytwo'] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
	google: 'Google',
	github: 'GitHub',
	fortytwo: '42',
};

export function oauthProviderLabel(provider: OAuthProvider): string {
	return PROVIDER_LABELS[provider];
}

export function parseOAuthProviders(raw: unknown): OAuthProvider[] {
	if (raw == null) return [];
	const values = String(raw)
		.split(',')
		.map((value) => value.trim().toLowerCase())
		.filter((value) => value.length > 0);
	const result: OAuthProvider[] = [];
	for (const value of values) {
		if ((OAUTH_PROVIDERS as readonly string[]).includes(value)) {
			const provider = value as OAuthProvider;
			if (!result.includes(provider)) result.push(provider);
		} else {
			console.warn(`Unknown OAuth provider ignored: ${value}`);
		}
	}
	return result;
}

export function isOAuthProviderEnabled(provider: string, raw?: unknown): boolean {
	const list = raw === undefined ? parseOAuthProviders(import.meta.env.PUBLIC_OAUTH_PROVIDERS) : parseOAuthProviders(raw);
	return list.includes(provider as OAuthProvider);
}

const envProviders = parseOAuthProviders(import.meta.env.PUBLIC_OAUTH_PROVIDERS);

export const oauthProviders: OAuthProvider[] = envProviders;

export function getOAuthProviders(raw?: unknown): OAuthProvider[] {
	return raw === undefined ? [...envProviders] : parseOAuthProviders(raw);
}
