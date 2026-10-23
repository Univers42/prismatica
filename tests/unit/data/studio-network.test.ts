import { describe, expect, it } from 'vitest';
import {
	APPS,
	ASSISTANT_PICKS,
	ENGINES,
	SPACES,
	STEPS,
	layoutStudioNetwork,
} from '../../../src/data/studio-network';

describe('studio network data', () => {
	it('gives engines and apps unique ids', () => {
		const ids = [...ENGINES, ...APPS].map((node) => node.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ENGINES).toHaveLength(10);
	});

	it('only references real engines and apps from spaces', () => {
		const known = new Set([...ENGINES, ...APPS].map((node) => node.id));
		SPACES.forEach((space) => {
			expect(space.engines.length).toBeGreaterThan(0);
			expect(space.apps.length).toBeGreaterThan(0);
			[...space.engines, ...space.apps].forEach((id) => expect(known.has(id)).toBe(true));
		});
	});

	it('tells the story in order', () => {
		expect(STEPS.map((step) => step.id)).toEqual(['engines', 'apps', 'spaces', 'assistant']);
	});

	it('draws one ray per engine and per app, and one organisation ring', () => {
		const layout = layoutStudioNetwork();
		expect(layout.engineRays).toHaveLength(ENGINES.length);
		expect(layout.appRays).toHaveLength(APPS.length);
		expect(layout.orgRing.r).toBeCloseTo(640 * 0.47);
		expect(layout.orgRing.d).toMatch(/^M \d/);
	});

	it('places app labels outside the ring with a valid anchor', () => {
		const size = 640;
		const { apps } = layoutStudioNetwork(size);
		apps.forEach((app) => {
			expect(['start', 'end', 'middle']).toContain(app.anchor);
			expect(app.labelX).toBeGreaterThanOrEqual(0);
			expect(app.labelX).toBeLessThanOrEqual(size);
			expect(app.labelY).toBeGreaterThanOrEqual(0);
			expect(app.labelY).toBeLessThanOrEqual(size);
		});
	});

	it('keeps every node point inside the viewBox', () => {
		const size = 640;
		const layout = layoutStudioNetwork(size);
		[...layout.engines, ...layout.apps].forEach((node) => {
			expect(node.x).toBeGreaterThanOrEqual(0);
			expect(node.x).toBeLessThanOrEqual(size);
			expect(node.y).toBeGreaterThanOrEqual(0);
			expect(node.y).toBeLessThanOrEqual(size);
		});
	});

	it('picks existing members of the team space for the assistant', () => {
		const team = SPACES.find((space) => space.id === 'team');
		expect(team).toBeDefined();
		if (!team) return;
		const engineIds = new Set(ENGINES.map((engine) => engine.id));
		const appIds = new Set(APPS.map((app) => app.id));
		ASSISTANT_PICKS.engines.forEach((id) => {
			expect(engineIds.has(id)).toBe(true);
			expect(team.engines).toContain(id);
		});
		ASSISTANT_PICKS.apps.forEach((id) => {
			expect(appIds.has(id)).toBe(true);
			expect(team.apps).toContain(id);
		});
	});
});
