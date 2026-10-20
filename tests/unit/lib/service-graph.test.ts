import { describe, expect, it } from 'vitest';
import {
	pipelineStatus,
	reachableEngines,
	servicesForProfiles,
	withoutDependents,
	withDependencies,
} from '../../../src/lib/service-graph';

describe('service graph', () => {
	describe('withDependencies', () => {
		it('closes query-router over its full dependency tree', () => {
			// The closure must pull the Go vault, the Rust plane, the policy and
			// log services, Redis, and the bootstrap jobs behind them.
			const closure = withDependencies(['query-router']);
			['query-router', 'adapter-registry-go', 'data-plane-router-rust', 'log-service', 'permission-engine', 'redis'].forEach((id) => {
				expect(closure.has(id)).toBe(true);
			});
			expect(closure.has('db-bootstrap')).toBe(true);
			expect(closure.has('postgres')).toBe(true);
			expect(closure.has('pg-migrate')).toBe(true);
			// The chain also pulls gotrue and mailpit through pg-migrate.
			expect(closure.size).toBe(11);
		});

		it('is a no-op for a service with no dependencies', () => {
			const closure = withDependencies(['postgres']);
			expect([...closure]).toEqual(['postgres']);
		});

		it('works on a small caller-supplied graph', () => {
			const closure = withDependencies(['b'], [
				{ id: 'a', name: 'A', group: 'core', kind: 'service', profiles: [], dependsOn: [], desc: '' },
				{ id: 'b', name: 'B', group: 'core', kind: 'service', profiles: [], dependsOn: ['a'], desc: '' },
			]);
			expect([...closure]).toEqual(['b', 'a']);
		});
	});

	describe('withoutDependents', () => {
		it('removes postgres and its enabled dependents', () => {
			const enabled = servicesForProfiles(['*']);
			const next = withoutDependents(enabled, 'postgres');
			expect(next.has('postgres')).toBe(false);
			// The Kong chain: postgrest → gotrue → kong → waf.
			['gotrue', 'postgrest', 'kong', 'waf'].forEach((id) => expect(next.has(id)).toBe(false));
			// Unrelated services survive.
			expect(next.has('mongo')).toBe(true);
			expect(next.has('ai-service')).toBe(true);
			// Original set untouched.
			expect(enabled.has('kong')).toBe(true);
		});

		it('removes a removed id that is not enabled without breaking others', () => {
			const enabled = new Set(['login', 'widget']);
			const next = withoutDependents(enabled, 'login', [
				{ id: 'login', name: 'Login', group: 'core', kind: 'service', profiles: [], dependsOn: [], desc: '' },
				{ id: 'widget', name: 'Widget', group: 'core', kind: 'service', profiles: [], dependsOn: ['login'], desc: '' },
			]);
			expect(next.size).toBe(0);
		});
	});

	describe('servicesForProfiles', () => {
		it('Core preset keeps the no-profile services plus dependencies', () => {
			const enabled = servicesForProfiles(['core']);
			['waf', 'kong', 'postgres', 'redis'].forEach((id) => expect(enabled.has(id)).toBe(true));
			expect(enabled.has('query-router')).toBe(false);
		});

		it('Everything preset selects all 55 services', () => {
			expect(servicesForProfiles(['*']).size).toBe(55);
		});

		it('matches any of the given profiles before closing dependencies', () => {
			// `analytics` alone pulls mongo (a dependency), not the whole set.
			const enabled = servicesForProfiles(['analytics']);
			expect(enabled.has('ai-service')).toBe(true);
			expect(enabled.has('mongo')).toBe(true);
			expect(enabled.has('kong')).toBe(false);
		});
	});

	describe('reachableEngines', () => {
		it('is empty without the query router', () => {
			const enabled = servicesForProfiles(['*']);
			enabled.delete('query-router');
			expect(reachableEngines(enabled)).toEqual([]);
		});

		it('is empty for an empty set', () => {
			expect(reachableEngines(new Set())).toEqual([]);
		});

		it('only lists engines whose backing service runs', () => {
			const enabled = servicesForProfiles(['*']);
			// Both routing hops plus every backing service are on in this set,
			// so all ten (backed and embedded) answer.
			expect(reachableEngines(enabled)).toEqual([
				'postgresql', 'cockroachdb', 'mongodb', 'mysql', 'mariadb', 'mssql', 'redis', 'dynamodb', 'sqlite', 'http',
			]);
			// Embedded SQLite and HTTP engines stay reachable with routers only.
			expect(reachableEngines(new Set(['query-router', 'data-plane-router-rust']))).toEqual(['sqlite', 'http']);
		});
	});

	describe('pipelineStatus', () => {
		it('blocks at permission-engine when it is removed', () => {
			const enabled = servicesForProfiles(['*']);
			enabled.delete('permission-engine');
			const status = pipelineStatus(enabled);
			expect(status.blockedAt).toBe('permission-engine');
			// The full set minus one service keeps the events plane on.
			expect(status.eventsBlockedAt).toBeNull();
			expect(status.hops.find((hop) => hop.service === 'outbox-relay')?.on).toBe(true);
		});

		it('blocks events at outbox-relay when only the request path runs', () => {
			// Request-side pipeline services plus a live engine service; no
			// events plane (outbox-relay, redis, webhook-dispatcher).
			const enabled = new Set([
				'waf', 'kong', 'query-router', 'permission-engine', 'adapter-registry-go', 'data-plane-router-rust', 'postgres',
			]);
			const status = pipelineStatus(enabled);
			expect(status.engine).toBe('postgresql');
			expect(status.blockedAt).toBeNull();
			expect(status.eventsBlockedAt).toBe('outbox-relay');
			const engineHop = status.hops.findIndex((hop) => hop.service === 'postgres');
			const dataPlane = status.hops.findIndex((hop) => hop.service === 'data-plane-router-rust');
			const events = status.hops.findIndex((hop) => hop.service === 'outbox-relay');
			expect(engineHop).toBe(dataPlane + 1);
			expect(events).toBe(engineHop + 1);
		});

		it('uses the embedded engine on the data plane when no engine service runs', () => {
			const enabled = new Set(['waf', 'kong', 'query-router', 'permission-engine', 'adapter-registry-go', 'data-plane-router-rust']);
			const status = pipelineStatus(enabled);
			expect(status.engine).toBe('sqlite');
			expect(status.blockedAt).toBeNull();
			expect(status.eventsBlockedAt).toBe('outbox-relay');
			const engineHop = status.hops.filter((hop) => hop.phase === 'request')[6];
			expect(engineHop.service).toBe('data-plane-router-rust');
			expect(engineHop.on).toBe(true);
		});

		it('marks the engine hop blocked when nothing is reachable', () => {
			const enabled = new Set(['waf', 'kong', 'query-router', 'permission-engine', 'adapter-registry-go']);
			const status = pipelineStatus(enabled);
			expect(status.engine).toBeNull();
			const engineHop = status.hops.filter((hop) => hop.phase === 'request')[6];
			expect(engineHop.service).toBe('engine');
			expect(engineHop.on).toBe(false);
		});

		it('reports every hop as on for the full compose set', () => {
			const status = pipelineStatus(servicesForProfiles(['*']));
			expect(status.blockedAt).toBeNull();
			expect(status.eventsBlockedAt).toBeNull();
			expect(status.hops.every((hop) => hop.on)).toBe(true);
			// 9 contract hops + the engine hop inserted after the data plane.
			expect(status.hops).toHaveLength(10);
		});

		it('works over a small caller-supplied graph', () => {
			const small = [
				{ id: 'query-router', name: 'Query router', group: 'core' as const, kind: 'service' as const, profiles: [], dependsOn: [], desc: '' },
				{ id: 'data-plane-router-rust', name: 'Data plane', group: 'data' as const, kind: 'service' as const, profiles: [], dependsOn: [], desc: '' },
			];
			const status = pipelineStatus(new Set(['query-router', 'data-plane-router-rust']), small);
			expect(status.engine).toBe('sqlite');
		});
	});
});
