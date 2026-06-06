#!/usr/bin/env node
/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   store.mjs                                          :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Pure unit tests for the bounded TTL store and RESP reply parser. No stack.
// Proves the memory backend evicts (kills the unbounded-growth DoS) and that
// the zero-dependency Redis reply parser frames integers, bulk strings, and
// arrays correctly while returning null on an incomplete buffer.

import { assert, passed, runChecks } from '../_shared.mjs';
import { MemoryStore, parseReply } from '../../auth/store.mjs';

export async function run() {
	return await runChecks([
		{
			name: 'incrWithTtl increments and sets a positive ttl',
			description: 'A counter created with a TTL increments and reports a positive, bounded pttl.',
			run: async () => {
				const store = new MemoryStore();
				const first = await store.incrWithTtl('counter', 60);
				const second = await store.incrWithTtl('counter', 60);
				assert.equal(first, 1, `first incr should be 1, got ${first}`);
				assert.equal(second, 2, `second incr should be 2, got ${second}`);
				const ttl = await store.pttl('counter');
				assert.ok(ttl > 0, `pttl should be positive, got ${ttl}`);
				assert.ok(ttl <= 60_000, `pttl should be <= 60000ms, got ${ttl}`);
				await store.close();
				return passed(`incrWithTtl gave 1,2 with pttl=${ttl}ms (0 < ttl <= 60000).`);
			},
		},
		{
			name: 'entries expire after their TTL',
			description: 'A key set with a tiny TTL is gone once the TTL has elapsed.',
			run: async () => {
				const store = new MemoryStore({ sweepMs: 60_000 });
				await store.set('ephemeral', 'x', 0.05); // 50ms ttl
				const ttl = await store.pttl('ephemeral');
				assert.ok(ttl > 0 && ttl <= 50, `freshly-set pttl should be 0<ttl<=50, got ${ttl}`);
				await new Promise((done) => setTimeout(done, 80));
				const value = await store.get('ephemeral');
				assert.equal(value, null, `expired key should read null, got ${value}`);
				assert.equal(await store.pttl('ephemeral'), -2, 'expired key pttl should be -2 (missing)');
				await store.close();
				return passed('Key with a 50ms TTL expired and read back as null (-2 pttl).');
			},
		},
		{
			name: 'size cap evicts oldest entries',
			description: 'A store capped at 3 entries never grows past 3 even after 5 inserts.',
			run: async () => {
				const store = new MemoryStore({ maxEntries: 3 });
				for (let index = 0; index < 5; index += 1) {
					await store.set(`key-${index}`, String(index), 0);
				}
				assert.ok(store.map.size <= 3, `size cap breached: ${store.map.size} > 3`);
				// Oldest inserts were evicted; the most recent survive.
				assert.equal(await store.get('key-4'), '4', 'most recent key was evicted');
				assert.equal(await store.get('key-0'), null, 'oldest key should have been evicted');
				await store.close();
				return passed(`After 5 inserts into a cap-3 store, size=${store.map.size} and the oldest key was evicted.`);
			},
		},
		{
			name: 'parseReply frames integers, bulk strings, and arrays',
			description: 'The RESP parser decodes :int, $bulk, and *array replies into JS values.',
			run: async () => {
				const integer = parseReply(Buffer.from(':5\r\n'));
				assert.deepEqual(integer?.value, 5, `integer parse failed: ${JSON.stringify(integer)}`);
				const bulk = parseReply(Buffer.from('$3\r\nabc\r\n'));
				assert.deepEqual(bulk?.value, 'abc', `bulk parse failed: ${JSON.stringify(bulk)}`);
				const array = parseReply(Buffer.from('*2\r\n:1\r\n:2\r\n'));
				assert.deepEqual(array?.value, [1, 2], `array parse failed: ${JSON.stringify(array)}`);
				return passed('parseReply decoded :5 -> 5, $3 abc -> "abc", *2 -> [1,2].');
			},
		},
		{
			name: 'parseReply returns null on an incomplete buffer',
			description: 'A truncated bulk reply must yield null so the client waits for more bytes.',
			run: async () => {
				const partial = parseReply(Buffer.from('$3\r\nab'));
				assert.equal(partial, null, `incomplete buffer should parse to null, got ${JSON.stringify(partial)}`);
				return passed('Incomplete bulk reply "$3\\r\\nab" parsed to null.');
			},
		},
	]);
}
