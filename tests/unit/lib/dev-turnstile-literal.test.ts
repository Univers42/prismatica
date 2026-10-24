/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   dev-turnstile-literal.test.ts                      :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/24 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/24 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { devTurnstileToken } from '../../../src/lib/dev-turnstile';

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : [join(dir, entry.name)]));
}

describe('the dev Turnstile literal', () => {
	it('appears in exactly one file under src/', () => {
		const hits = sourceFiles('src').filter((file) => readFileSync(file, 'utf8').includes('localhost-turnstile-token'));
		expect(hits).toEqual([join('src', 'lib', 'dev-turnstile.ts')]);
	});

	afterEach(() => vi.unstubAllEnvs());

	it('is handed out in dev and is an empty string in a production build', () => {
		vi.stubEnv('DEV', true);
		expect(devTurnstileToken()).toBe('localhost-turnstile-token');
		vi.stubEnv('DEV', false);
		expect(devTurnstileToken()).toBe('');
	});
});
