import { describe, expect, it } from 'vitest';
import { SCENE_IDS, sceneLayout, stagePoolSize } from '../../../src/lib/stage-scenes';

const sizes = [
	{ width: 360, height: 740 },
	{ width: 1440, height: 900 },
];

describe('sceneLayout', () => {
	for (const { width, height } of sizes) {
		const count = stagePoolSize(width);
		for (const id of SCENE_IDS) {
			it(`${id} at ${width}×${height} fills the pool with valid nodes and edges`, () => {
				const layout = sceneLayout(id, width, height, count);
				expect(layout.nodes).toHaveLength(count);
				for (const node of layout.nodes) {
					expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
					expect(node.size).toBeGreaterThan(0);
				}
				for (const [a, b] of layout.edges) {
					expect(a).toBeGreaterThanOrEqual(0);
					expect(b).toBeLessThan(count);
					expect(a).not.toBe(b);
				}
				for (const index of layout.spokes) expect(index).toBeLessThan(count);
				expect(layout.intensity).toBeGreaterThan(0);
				expect(layout.intensity).toBeLessThanOrEqual(1);
			});
		}
	}

	it('keeps every structural scene node on screen', () => {
		const { width, height } = sizes[0]!;
		for (const id of SCENE_IDS.filter((scene) => scene !== 'hero')) {
			const layout = sceneLayout(id, width, height, stagePoolSize(width));
			for (const node of layout.nodes.filter((entry) => entry.role !== 'dust')) {
				expect(node.x).toBeGreaterThanOrEqual(0);
				expect(node.x).toBeLessThanOrEqual(width);
				expect(node.y).toBeGreaterThanOrEqual(0);
				expect(node.y).toBeLessThanOrEqual(height);
			}
		}
	});

	it('is deterministic, so a resize never reshuffles the sky', () => {
		expect(sceneLayout('apps', 1440, 900, 72)).toEqual(sceneLayout('apps', 1440, 900, 72));
	});

	it('gives the hero only stars and parks the planet below the fold', () => {
		const hero = sceneLayout('hero', 1440, 900, 72);
		expect(hero.edges).toHaveLength(0);
		expect(hero.nodes.every((node) => node.role === 'dust')).toBe(true);
		expect(hero.hub.y - hero.hub.r).toBeGreaterThan(900 * 0.5);
	});

	it('draws the services scene as a honeycomb of seven cells', () => {
		const layout = sceneLayout('architecture', 1440, 900, 72);
		expect(layout.nodes.filter((node) => node.role === 'accent')).toHaveLength(7);
		expect(layout.edges.length).toBeGreaterThanOrEqual(30);
	});

	it('sizes the pool by screen width', () => {
		expect(stagePoolSize(360)).toBeLessThan(stagePoolSize(1440));
		expect(stagePoolSize(360)).toBeGreaterThanOrEqual(44);
	});
});
