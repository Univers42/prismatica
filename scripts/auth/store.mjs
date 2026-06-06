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
//   - RedisStore: a tiny zero-dependency RESP client (node:net / node:tls) so we
//     keep the gateway image's "no transitive npm deps" property. Used when
//     REDIS_URL is set; gives shared + restart-surviving state.
// The facade prefers Redis when connected and falls back to memory on any Redis
// error, so a Redis outage degrades to single-process throttling instead of
// failing authentication. State stores NEVER fail auth open.

import net from 'node:net';
import tls from 'node:tls';

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
// Minimal RESP reply parser. Returns { value, end } or null if incomplete.
// --------------------------------------------------------------------------
export function parseReply(buffer, offset = 0) {
	if (offset >= buffer.length) return null;
	const type = buffer[offset];
	const lineEnd = buffer.indexOf('\r\n', offset);
	if (lineEnd === -1) return null;
	const line = buffer.toString('utf8', offset + 1, lineEnd);
	const next = lineEnd + 2;
	switch (type) {
		case 0x2b: // + simple string
			return { value: line, end: next };
		case 0x2d: // - error
			return { value: new Error(line), end: next };
		case 0x3a: // : integer
			return { value: Number(line), end: next };
		case 0x24: {
			// $ bulk string
			const length = Number(line);
			if (length === -1) return { value: null, end: next };
			const strEnd = next + length;
			if (strEnd + 2 > buffer.length) return null;
			return { value: buffer.toString('utf8', next, strEnd), end: strEnd + 2 };
		}
		case 0x2a: {
			// * array
			const count = Number(line);
			if (count === -1) return { value: null, end: next };
			const items = [];
			let cursor = next;
			for (let index = 0; index < count; index += 1) {
				const reply = parseReply(buffer, cursor);
				if (!reply) return null;
				items.push(reply.value);
				cursor = reply.end;
			}
			return { value: items, end: cursor };
		}
		default:
			return null;
	}
}

function encodeCommand(args) {
	let out = `*${args.length}\r\n`;
	for (const arg of args) {
		const value = String(arg);
		out += `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
	}
	return out;
}

// --------------------------------------------------------------------------
// Tiny RESP Redis client (no external dependency)
// --------------------------------------------------------------------------
export class RedisStore {
	constructor(url, { reconnectMs = 2000, logger = console } = {}) {
		this.url = url;
		this.reconnectMs = reconnectMs;
		this.logger = logger;
		this.ready = false;
		this.socket = null;
		this.buffer = Buffer.alloc(0);
		this.queue = [];
		this.closed = false;
		this.#connect();
	}

	get connected() {
		return this.ready;
	}

	#connect() {
		if (this.closed) return;
		let parsed;
		try {
			parsed = new URL(this.url);
		} catch {
			this.logger.warn?.('[auth-gateway] REDIS_URL is invalid; using in-memory store only.');
			return;
		}
		const useTls = parsed.protocol === 'rediss:';
		const port = Number(parsed.port || 6379);
		const onConnect = async () => {
			try {
				if (parsed.password) {
					const user = parsed.username ? [decodeURIComponent(parsed.username)] : [];
					await this.#send(['AUTH', ...user, decodeURIComponent(parsed.password)]);
				}
				const db = parsed.pathname.replace(/^\//, '');
				if (db) await this.#send(['SELECT', db]);
				this.ready = true;
				this.logger.info?.('[auth-gateway] connected to Redis for shared rate-limit/lockout state.');
			} catch {
				this.ready = false;
			}
		};
		this.socket = useTls
			? tls.connect({ host: parsed.hostname, port, servername: parsed.hostname }, onConnect)
			: net.connect({ host: parsed.hostname, port }, onConnect);
		this.socket.on('data', (chunk) => this.#onData(chunk));
		this.socket.on('error', () => {});
		this.socket.on('close', () => {
			this.ready = false;
			this.#failQueue(new Error('redis connection closed'));
			if (!this.closed) setTimeout(() => this.#connect(), this.reconnectMs).unref?.();
		});
	}

	#onData(chunk) {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		for (;;) {
			const reply = parseReply(this.buffer, 0);
			if (!reply) break;
			this.buffer = this.buffer.subarray(reply.end);
			const waiter = this.queue.shift();
			if (!waiter) continue;
			if (reply.value instanceof Error) waiter.reject(reply.value);
			else waiter.resolve(reply.value);
		}
	}

	#failQueue(error) {
		while (this.queue.length) this.queue.shift().reject(error);
	}

	#send(args) {
		return new Promise((resolve, reject) => {
			if (!this.socket || this.socket.destroyed) {
				reject(new Error('redis not connected'));
				return;
			}
			this.queue.push({ resolve, reject });
			this.socket.write(encodeCommand(args));
		});
	}

	async command(args) {
		if (!this.ready) throw new Error('redis not ready');
		return this.#send(args);
	}

	async get(key) {
		return this.command(['GET', key]);
	}

	async set(key, value, ttlSeconds = 0) {
		return ttlSeconds ? this.command(['SET', key, String(value), 'EX', String(ttlSeconds)]) : this.command(['SET', key, String(value)]);
	}

	async del(key) {
		return this.command(['DEL', key]);
	}

	async incrWithTtl(key, ttlSeconds) {
		const count = await this.command(['INCR', key]);
		if (count === 1 && ttlSeconds) await this.command(['EXPIRE', key, String(ttlSeconds)]);
		return count;
	}

	async pttl(key) {
		return this.command(['PTTL', key]);
	}

	async close() {
		this.closed = true;
		this.socket?.destroy();
	}
}

// --------------------------------------------------------------------------
// Facade: Redis-when-connected, memory fallback on any error. Never throws to
// the caller (a store failure must not fail authentication open).
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

	return {
		backendName: () => (redis?.connected ? 'redis' : 'memory'),
		get: (key) => viaRedisOr((m) => m.get(key), (r) => r.get(key)),
		set: (key, value, ttl) => viaRedisOr((m) => m.set(key, value, ttl), (r) => r.set(key, value, ttl)),
		del: (key) => viaRedisOr((m) => m.del(key), (r) => r.del(key)),
		incrWithTtl: (key, ttl) => viaRedisOr((m) => m.incrWithTtl(key, ttl), (r) => r.incrWithTtl(key, ttl)),
		pttl: (key) => viaRedisOr((m) => m.pttl(key), (r) => r.pttl(key)),
		close: async () => {
			await mem.close();
			await redis?.close();
		},
	};
}
