/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   dev-turnstile.ts                                   :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/24 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/24 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// The only home of the token scripts/auth-gateway.mjs admits under TURNSTILE_BYPASS_LOCAL.
// Read at call time so a production bundle (DEV false) folds it to '' and the literal is
// tree-shaken out; tests/unit/lib/dev-turnstile-literal.test.ts pins this file as the only hit under src/.
const DEV_TOKEN = 'localhost-turnstile-token';

export function devTurnstileToken(): string {
	return import.meta.env.DEV ? DEV_TOKEN : '';
}
