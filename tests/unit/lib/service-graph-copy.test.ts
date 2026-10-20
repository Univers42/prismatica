import { describe, expect, it } from 'vitest';
import { SERVICES, type GrobaseService } from '../../../src/data/grobase-services';
import { pipelineStatus, servicesForProfiles, withDependencies, withoutDependents } from '../../../src/lib/service-graph';
import { describeChange, eventsText, pathText } from '../../../src/lib/service-graph-copy';

const NAMES = new Map(SERVICES.map((service) => [service.id, service.name]));

// Caller-supplied graph: postgres ← db-bootstrap, postgres ← postgrest,
// postgrest ← kong. Enough to walk a stop cascade without pulling the whole
// compose file in.
function pick(id: string): GrobaseService {
	const found = SERVICES.find((service) => service.id === id);
	if (!found) throw new Error(`missing service ${id}`);
	return found;
}
const SMALL = [pick('postgres'), pick('db-bootstrap'), pick('postgrest'), pick('kong')];

// Fan-out graph so the "and N more" branch has a stable, hand-countable shape:
// t → x, y; y → u, v, w. Starting t pulls exactly five services.
const FAN = [
	svc('t', 'Target', ['x', 'y']),
	svc('x', 'Xanadu', []),
	svc('y', 'Yoke', ['u', 'v', 'w']),
	svc('u', 'Umbra', []),
	svc('v', 'Vane', []),
	svc('w', 'Wisp', []),
];
function svc(id: string, name: string, dependsOn: string[]): GrobaseService {
	return { id, name, group: 'core', kind: 'service', profiles: [], dependsOn, desc: '' };
}
const FAN_NAMES = new Map(FAN.map((service) => [service.id, service.name]));

describe('describeChange', () => {
	it('names only the target when starting pulls no dependencies', () => {
		const text = describeChange(new Set(), new Set(['postgres']), 'postgres', NAMES);
		expect(text).toBe('Started PostgreSQL.');
	});

	it('skips dependencies that were already running', () => {
		// db-bootstrap and postgres both already on: only one name to read.
		const after = withDependencies(['postgrest'], SMALL);
		const text = describeChange(new Set(['postgres']), after, 'postgrest', NAMES);
		expect(text).toBe('Started PostgREST with db-bootstrap.');
	});

	it('lists two pulled dependencies joined with and', () => {
		const after = withDependencies(['postgrest'], SMALL);
		const text = describeChange(new Set(), after, 'postgrest', NAMES);
		expect(text).toBe('Started PostgREST with db-bootstrap and PostgreSQL.');
	});

	it('caps the list at two names and counts the rest', () => {
		const after = withDependencies(['t'], FAN);
		const text = describeChange(new Set(), after, 't', FAN_NAMES);
		expect(text).toBe('Started Target with Xanadu, Yoke and 3 more.');
	});

	it('reports only a count when stopping pulls dependents down', () => {
		const before = new Set(['postgres', 'db-bootstrap', 'postgrest', 'kong']);
		const after = withoutDependents(before, 'postgres', SMALL);
		const text = describeChange(before, after, 'postgres', NAMES);
		expect(text).toBe('Stopped PostgreSQL and 3 services that need it.');
	});

	it('reports only the target when nothing else stopped', () => {
		const before = new Set(['postgres', 'redis']);
		const after = withoutDependents(before, 'postgres', SMALL);
		const text = describeChange(before, after, 'postgres', NAMES);
		expect(text).toBe('Stopped PostgreSQL.');
	});

	it('says nothing changed when the target is already on', () => {
		const text = describeChange(new Set(['postgres']), new Set(['postgres']), 'postgres', NAMES);
		expect(text).toBe('Nothing changed.');
	});
});

describe('pathText', () => {
	it('names the blocking hop when the request path is blocked', () => {
		const status = pipelineStatus(new Set(['waf', 'kong']));
		expect(status.blockedAt).toBe('query-router');
		expect(pathText(status, NAMES)).toBe('Blocked at Query router');
	});

	it('names the serving engine when the request path is complete', () => {
		const status = pipelineStatus(servicesForProfiles(['*']));
		expect(status.blockedAt).toBeNull();
		expect(pathText(status, NAMES)).toBe('Complete: served by PostgreSQL');
	});
});

describe('eventsText', () => {
	it('reports delivery when the events plane is complete', () => {
		const status = pipelineStatus(servicesForProfiles(['*']));
		expect(status.eventsBlockedAt).toBeNull();
		expect(eventsText(status, NAMES)).toBe('Delivered as signed webhooks');
	});

	it('names the blocked events hop', () => {
		const enabled = new Set(['waf', 'kong', 'query-router', 'permission-engine', 'adapter-registry-go', 'data-plane-router-rust']);
		const status = pipelineStatus(enabled);
		expect(status.eventsBlockedAt).toBe('outbox-relay');
		expect(eventsText(status, NAMES)).toBe('Not delivered: Outbox relay is off');
	});
});
