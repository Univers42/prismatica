// Tiny zero-dependency Redis client (node:net / node:tls, RESP2) behind the auth store
// (store.mjs), so the gateway image keeps no transitive npm dependency.

import net from 'node:net';
import tls from 'node:tls';

// Compare-and-delete: releases a lock only for the owner that took it.
const DEL_IF_EQUALS = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";

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

	async setIfAbsent(key, value, ttlSeconds) {
		return (await this.command(['SET', key, String(value), 'NX', 'EX', String(ttlSeconds)])) === 'OK';
	}

	async delIfEquals(key, value) {
		return (await this.command(['EVAL', DEL_IF_EQUALS, '1', key, String(value)])) === 1;
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
