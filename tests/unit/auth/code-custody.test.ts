/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   code-custody.test.ts                               :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/10/24 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/24 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bumpCounter, claimOnce, CODE_TTL_SEC, hashCode, isLoginCode, MAX_WRONG_CODES, sameCode } from '../../../scripts/auth/code-custody.mjs';
import { memoryStore } from './fakes';

const input = { signingKey: 'pepper-one-0123456789abcdef0123456789', info: 'test-info', email: 'ines@arlet.test', code: '123456' };

describe('code custody primitives', () => {
	it('pins the lifetime and the cap the login step used before the extract', () => {
		expect([CODE_TTL_SEC, MAX_WRONG_CODES]).toEqual([600, 5]);
	});

	it.each([['123456', true], ['000000', true], ['12345', false], ['1234567', false], ['12345a', false], [' 123456', false], ['١٢٣٤٥٦', false], [123456, false], [null, false]])('isLoginCode(%j) is %s', (value, expected) => {
		expect(isLoginCode(value)).toBe(expected);
	});

	it('bumpCounter crosses the cap on the sixth step', async () => {
		const store = memoryStore();
		const counts = [];
		for (let step = 0; step < 6; step += 1) counts.push(await bumpCounter(store, 'k', 60));
		expect(counts).toEqual([1, 2, 3, 4, 5, 6]);
		expect(counts.filter((count) => count < MAX_WRONG_CODES)).toHaveLength(MAX_WRONG_CODES - 1);
	});

	it('claimOnce is true once per key, even for parallel claims', async () => {
		const store = memoryStore();
		const outcomes = await Promise.all(Array.from({ length: 8 }, () => claimOnce(store, 'claim', 60)));
		expect(outcomes.filter(Boolean)).toHaveLength(1);
		expect(await claimOnce(store, 'other', 60)).toBe(true);
	});

	it('hashCode is stable and differs per email, code and pepper', () => {
		const base = hashCode(input);
		expect(hashCode(input)).toBe(base);
		expect(hashCode({ ...input, email: 'other@arlet.test' })).not.toBe(base);
		expect(hashCode({ ...input, code: '654321' })).not.toBe(base);
		expect(hashCode({ ...input, signingKey: 'pepper-two-0123456789abcdef0123456789' })).not.toBe(base);
		expect(hashCode({ ...input, info: 'other-info' })).not.toBe(base);
		expect(hashCode({ ...input, email: ' INES@arlet.test ' })).toBe(base);
		expect(base).not.toContain(input.code);
	});

	it('sameCode is true only for the right code', () => {
		const stored = hashCode(input);
		expect(sameCode(stored, hashCode(input))).toBe(true);
		expect(sameCode(stored, hashCode({ ...input, code: '000000' }))).toBe(false);
		expect(sameCode(stored, 'short')).toBe(false);
		expect(sameCode(stored, '')).toBe(false);
	});
});
