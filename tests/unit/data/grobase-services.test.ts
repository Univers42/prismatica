import { describe, expect, it } from 'vitest';
import { ENGINES, GROUPS, PIPELINE, PRESETS, SERVICES } from '../../../src/data/grobase-services';

describe('grobase services data', () => {
	// The compose snapshot contains exactly 55 services.
	it('has exactly 55 services with unique ids', () => {
		expect(SERVICES).toHaveLength(55);
		expect(new Set(SERVICES.map((service) => service.id)).size).toBe(55);
	});

	it('references an existing service for every dependency', () => {
		const known = new Set(SERVICES.map((service) => service.id));
		SERVICES.forEach((service) => {
			service.dependsOn.forEach((dep) => expect(known.has(dep)).toBe(true));
		});
	});

	it('covers every group with at least one service and a label', () => {
		GROUPS.forEach((group) => {
			expect(group.label.length).toBeGreaterThan(0);
			expect(SERVICES.some((service) => service.group === group.id)).toBe(true);
		});
	});

	it('matches the six jobs to an existing parent in the same group', () => {
		const jobs = SERVICES.filter((service) => service.kind === 'job');
		expect(jobs.map((job) => job.id)).toEqual([
			'db-bootstrap', 'pg-migrate', 'mongo-init', 'mongo-keyfile', 'minio-iceberg-init', 'vault-init',
		]);
		const byId = new Map(SERVICES.map((service) => [service.id, service]));
		jobs.forEach((job) => {
			const parent = byId.get(job.parent ?? '');
			expect(parent).toBeDefined();
			if (!parent) return;
			expect(parent.kind).toBe('service');
			expect(parent.group).toBe(job.group);
		});
	});

	it('lists ten engines whose backing services exist', () => {
		expect(ENGINES).toHaveLength(10);
		const known = new Set(SERVICES.filter((service) => service.kind === 'service').map((service) => service.id));
		// Embedded engines (SQLite, HTTP APIs) have no backing service.
		ENGINES.forEach((engine) => {
			if (engine.service !== null) expect(known.has(engine.service)).toBe(true);
		});
		expect(ENGINES.filter((engine) => engine.service === null).map((engine) => engine.id)).toEqual(['sqlite', 'http']);
	});

	it('builds the pipeline from services that exist', () => {
		const known = new Set(SERVICES.map((service) => service.id));
		PIPELINE.forEach((hop) => expect(known.has(hop.service)).toBe(true));
	});

	it('matches the compose snapshot for five spot checks', () => {
		// Profiles and depends_on copied from grobase-services.json (2026-10-20).
		const spot = (id: string, profiles: string[], dependsOn: string[]) => {
			const service = SERVICES.find((entry) => entry.id === id);
			expect(service).toBeDefined();
			expect(service?.profiles).toEqual(profiles);
			expect(service?.dependsOn).toEqual(dependsOn);
		};
		spot('query-router', ['adapter-plane'], ['adapter-registry-go', 'data-plane-router-rust', 'log-service', 'permission-engine', 'redis']);
		spot('kong', ['core'], ['gotrue', 'postgrest', 'realtime']);
		spot('trino', ['analytics', 'extras'], ['iceberg-rest', 'mongo', 'mysql', 'postgres']);
		spot('outbox-relay', ['legacy-node'], ['db-bootstrap', 'mongo', 'realtime', 'redis']);
		spot('vault-init', ['secrets'], ['vault']);
	});

	it('offers four presets including the full compose set', () => {
		expect(PRESETS.map((preset) => preset.id)).toEqual(['core', 'query', 'governed', 'everything']);
	});
});
