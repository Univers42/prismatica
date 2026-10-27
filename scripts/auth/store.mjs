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

// Shared, TTL-bounded key/value + counter store for the auth gateway.
//
// THREAT (MEDIUM): rate-limit / lockout / anti-replay state used to live in
// plain in-process `Map`s that NEVER evicted (unbounded -> memory DoS, amplified
// by the spoofable client IP), did not survive restart, and were not shared
// across replicas.
//
// FIX: a small store with two backends and a single interface:
//   - MemoryStore: bounded (size cap + TTL sweep) — always available, kills the
//     unbounded-growth DoS even with no Redis.
//   - RedisStore (redis-store.mjs): a tiny zero-dependency RESP client so we
//     keep the gateway image's "no transitive npm deps" property. Used when
//     REDIS_URL is set; gives shared + restart-surviving state.
// The facade prefers Redis when connected and falls back to memory on any Redis
// error, so a Redis outage degrades to single-process throttling instead of
// failing authentication. State stores NEVER fail auth open.

import { RedisStore } from './redis-store.mjs';

export { parseReply, RedisStore } from './redis-store.mjs';

const MINUTE = 60_000;

// --------------------------------------------------------------------------
// Bounded in-memory backend
// --------------------------------------------------------------------------
export class MemoryStore {
	constructor({ maxEntries = 50_000, sweepMs = MINUTE } = {}) {
		this.map = new Map(); // key -> { value: string, expiresAt: number (0 = no ttl) }
		this.maxEntries = maxEntries;
		this.sweeper = setInterval(() => this.sweep(), sweepMs);
		this.sweeper.unref?.();
	}

	#live(key) {
		const entry = this.map.get(key);
		if (!entry) return null;
		if (entry.expiresAt && entry.expiresAt <= Date.now()) {
			this.map.delete(key);
			return null;
		}
		return entry;
	}

	#evict() {
		while (this.map.size > this.maxEntries) {
			const oldest = this.map.keys().next().value;
			if (oldest === undefined) break;
			this.map.delete(oldest);
		}
	}

	sweep() {
		const now = Date.now();
		for (const [key, entry] of this.map) {
			if (entry.expiresAt && entry.expiresAt <= now) this.map.delete(key);
		}
	}

	async get(key) {
		return this.#live(key)?.value ?? null;
	}

	async set(key, value, ttlSeconds = 0) {
		this.map.delete(key); // re-insert at the end (insertion-order = recency)
		this.map.set(key, { value: String(value), expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });
		this.#evict();
	}

	async del(key) {
		this.map.delete(key);
	}

	async setIfAbsent(key, value, ttlSeconds) {
		if (this.#live(key)) return false;
		await this.set(key, value, ttlSeconds);
		return true;
	}

	async delIfEquals(key, value) {
		if (this.#live(key)?.value !== String(value)) return false;
		this.map.delete(key);
		return true;
	}

	async incrWithTtl(key, ttlSeconds) {
		const entry = this.#live(key);
		const next = (entry ? Number(entry.value) || 0 : 0) + 1;
		const expiresAt = entry ? entry.expiresAt : ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0;
		this.map.delete(key);
		this.map.set(key, { value: String(next), expiresAt });
		this.#evict();
		return next;
	}

	// remaining milliseconds, or -1 (no ttl) / -2 (missing) like Redis PTTL
	async pttl(key) {
		const entry = this.#live(key);
		if (!entry) return -2;
		if (!entry.expiresAt) return -1;
		return Math.max(0, entry.expiresAt - Date.now());
	}

	async close() {
		clearInterval(this.sweeper);
	}
}

// --------------------------------------------------------------------------
// Facade: Redis-when-connected, memory fallback on any error. Never throws to
// the caller (a store failure must not fail authentication open), except the lock pair below.
// --------------------------------------------------------------------------
export function createStore({ redisUrl = '', memory = {}, logger = console } = {}) {
	const mem = new MemoryStore(memory);
	const redis = redisUrl ? new RedisStore(redisUrl, { logger }) : null;

	async function viaRedisOr(memCall, redisCall) {
		if (redis?.connected) {
			try {
				return await redisCall(redis);
			} catch {
				// fall through to memory
			}
		}
		return memCall(mem);
	}

	async function viaRedisOnly(redisCall, memCall) {
		if (!redis) return memCall(mem);
		if (!redis.connected) throw new Error('redis not connected');
		return redisCall(redis);
	}

	return {
		backendName: () => (redis?.connected ? 'redis' : 'memory'),
		get: (key) => viaRedisOr((m) => m.get(key), (r) => r.get(key)),
		set: (key, value, ttl) => viaRedisOr((m) => m.set(key, value, ttl), (r) => r.set(key, value, ttl)),
		del: (key) => viaRedisOr((m) => m.del(key), (r) => r.del(key)),
		incrWithTtl: (key, ttl) => viaRedisOr((m) => m.incrWithTtl(key, ttl), (r) => r.incrWithTtl(key, ttl)),
		pttl: (key) => viaRedisOr((m) => m.pttl(key), (r) => r.pttl(key)),
		// A lock that fell back to one process's memory locks nothing the other replicas see, so these
		// two never fall back: with Redis configured they reject while it is unreachable.
		setIfAbsent: (key, value, ttl) => viaRedisOnly((r) => r.setIfAbsent(key, value, ttl), (m) => m.setIfAbsent(key, value, ttl)),
		delIfEquals: (key, value) => viaRedisOnly((r) => r.delIfEquals(key, value), (m) => m.delIfEquals(key, value)),
		close: async () => {
			await mem.close();
			await redis?.close();
		},
	};
}
