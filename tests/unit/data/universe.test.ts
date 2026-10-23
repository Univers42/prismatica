import { describe, expect, it } from 'vitest';
import { CONNECTED_APPS } from '../../../src/data/connected-apps';
import { UNIVERSE_LINKS, UNIVERSE_NODES } from '../../../src/data/universe';

describe('hero universe graph', () => {
	const ids = new Set(UNIVERSE_NODES.map((node) => node.id));

	it('gives every node a unique id', () => {
		expect(ids.size).toBe(UNIVERSE_NODES.length);
	});

	it('links only nodes that exist, never a node to itself, never twice', () => {
		const seen = new Set<string>();
		for (const [from, to] of UNIVERSE_LINKS) {
			expect(ids.has(from), from).toBe(true);
			expect(ids.has(to), to).toBe(true);
			expect(from).not.toBe(to);
			const key = [from, to].sort().join('|');
			expect(seen.has(key), key).toBe(false);
			seen.add(key);
		}
	});

	it('lights at least one phone-visible item for every app the demo can insert', () => {
		for (const app of CONNECTED_APPS) {
			expect(UNIVERSE_NODES.some((node) => node.app === app.id && !node.wideOnly), app.id).toBe(true);
		}
	});

	it('leaves no node unlinked', () => {
		for (const id of ids) {
			expect(UNIVERSE_LINKS.some((link) => link.includes(id)), id).toBe(true);
		}
	});
});
