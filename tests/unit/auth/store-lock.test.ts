// @vitest-environment node
// The account-link lock (C374/C375): exactly one of two concurrent takers wins on either backend,
// expiry frees the key, only the owner releases it, and a configured-but-unreachable Redis
// refuses instead of locking one process's memory.
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryStore, RedisStore, createStore } from '../../../scripts/auth/store.mjs';

// The unreachable-Redis case logs through it; the tests assert outcomes, not log lines.
const quiet = { warn() {}, info() {}, error() {} } as unknown as Console;
const closers: (() => Promise<void> | void)[] = [];
afterEach(async () => {
	while (closers.length) await closers.pop()?.();
});

function decode(frame: string) {
	const parts = frame.split('\r\n');
	const args: string[] = [];
	for (let index = 2; index < parts.length; index += 2) args.push(parts[index]);
	return args.slice(0, Number(parts[0].slice(1)));
}

// A RESP server that keeps real NX and compare-and-delete semantics and records every command.
async function fakeRedis() {
	const commands: string[][] = [];
	const keys = new Map<string, string>();
	const server = net.createServer((socket) => {
		socket.on('data', (chunk) => {
			for (const frame of chunk.toString().split(/(?=\*\d+\r\n\$)/)) {
				const args = decode(frame);
				commands.push(args);
				if (args[0] === 'SET') {
					if (keys.has(args[1])) socket.write('$-1\r\n');
					else socket.write((keys.set(args[1], args[2]), '+OK\r\n'));
				} else if (args[0] === 'EVAL') {
					const owned = keys.get(args[3]) === args[4];
					if (owned) keys.delete(args[3]);
					socket.write(`:${owned ? 1 : 0}\r\n`);
				} else socket.write('+OK\r\n');
			}
		});
	});
	await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
	closers.push(() => new Promise<void>((done) => server.close(() => done())));
	return { commands, port: (server.address() as net.AddressInfo).port };
}

async function connected(store: RedisStore) {
	for (let tries = 0; tries < 50 && !store.connected; tries += 1) await new Promise((done) => setTimeout(done, 10));
	expect(store.connected).toBe(true);
}

describe('MemoryStore lock', () => {
	it('lets exactly one of two concurrent takers win, and frees the key when it expires', async () => {
		const store = new MemoryStore();
		closers.push(() => store.close());
		const won = await Promise.all([store.setIfAbsent('lock', 'a', 0.05), store.setIfAbsent('lock', 'b', 0.05)]);
		expect(won.filter(Boolean)).toHaveLength(1);
		await new Promise((done) => setTimeout(done, 80));
		expect(await store.setIfAbsent('lock', 'c', 60)).toBe(true);
	});

	it('releases only for the owner token', async () => {
		const store = new MemoryStore();
		closers.push(() => store.close());
		await store.setIfAbsent('lock', 'owner', 60);
		expect(await store.delIfEquals('lock', 'intruder')).toBe(false);
		expect(await store.get('lock')).toBe('owner');
		expect(await store.delIfEquals('lock', 'owner')).toBe(true);
		expect(await store.get('lock')).toBeNull();
	});
});

describe('RedisStore lock', () => {
	it('sends one SET NX EX per taker, lets one win, and releases through compare-and-delete', async () => {
		const redis = await fakeRedis();
		const store = new RedisStore(`redis://127.0.0.1:${redis.port}`, { logger: quiet });
		closers.push(() => store.close());
		await connected(store);
		const won = await Promise.all([store.setIfAbsent('lock', 'a', 60), store.setIfAbsent('lock', 'b', 60)]);
		expect(won.filter(Boolean)).toHaveLength(1);
		const sets = redis.commands.filter((args) => args[0] === 'SET');
		expect(sets).toEqual([
			['SET', 'lock', 'a', 'NX', 'EX', '60'],
			['SET', 'lock', 'b', 'NX', 'EX', '60'],
		]);
		const owner = won[0] ? 'a' : 'b';
		expect(await store.delIfEquals('lock', owner === 'a' ? 'b' : 'a')).toBe(false);
		expect(await store.delIfEquals('lock', owner)).toBe(true);
	});
});

describe('createStore lock', () => {
	it('refuses while a configured Redis is unreachable instead of falling back to memory', async () => {
		const store = createStore({ redisUrl: 'redis://127.0.0.1:1', logger: quiet });
		closers.push(() => store.close());
		await expect(store.setIfAbsent('lock', 'a', 60)).rejects.toThrow(/redis/);
		await expect(store.delIfEquals('lock', 'a')).rejects.toThrow(/redis/);
		expect(await store.get('anything')).toBeNull();
	});

	it('locks in memory when no Redis is configured', async () => {
		const store = createStore({ logger: quiet });
		closers.push(() => store.close());
		expect(await store.setIfAbsent('lock', 'a', 60)).toBe(true);
		expect(await store.setIfAbsent('lock', 'b', 60)).toBe(false);
		expect(await store.delIfEquals('lock', 'a')).toBe(true);
	});
});
