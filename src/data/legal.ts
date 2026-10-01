/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   legal.ts                                           :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

export const POLICY_VERSION = '1.1.0';
export const POLICY_LAST_UPDATED = '2026-10-01';

export const DATA_CONTROLLER = {
	name: 'dlesieur',
	email: 'dev.pro.photo@gmail.com',
} as const;

export const LEGAL_LINKS = [
	{ href: '/legal/privacy-policy/', label: 'Privacy Policy' },
	{ href: '/legal/terms/', label: 'Terms of Service' },
	{ href: '/legal/cookies/', label: 'Cookie Policy' },
	{ href: '/legal/data-rights/', label: 'Data Rights' },
] as const;

export const CONSENT_STORAGE_KEY = 'prismatica-consent-v1';
export const NEWSLETTER_INTENT_KEY = 'prismatica-newsletter-intent-v1';
export const CSRF_STORAGE_KEY = 'prismatica-csrf-token-v1';
