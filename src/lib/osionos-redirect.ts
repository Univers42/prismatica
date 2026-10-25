/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   osionos-redirect.ts                                :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/25 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/25 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

export function isTrustedOsionosRedirect(redirectUrl: string): boolean {
	try {
		const parsed = new URL(redirectUrl, window.location.origin);
		const allowed = [
			window.location.origin,
			import.meta.env.PUBLIC_OSIONOS_APP_URL,
			'https://app.osionos.com',
			'http://localhost:3000',
			'http://localhost:4321',
			'http://localhost:4322',
		].filter(Boolean);
		return allowed.some((origin) => {
			try {
				return new URL(origin).origin === parsed.origin;
			} catch {
				return false;
			}
		});
	} catch {
		return false;
	}
}
