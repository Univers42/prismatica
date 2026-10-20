// Pure helpers over the grobase service graph: dependency closure, dependents,
// profile selection, reachable engines and pipeline status. Every function
// takes the graph as a parameter (defaulting to the shipped SERVICES) so tests
// can feed small graphs. No DOM access.

import { ENGINES, PIPELINE, SERVICES, type GrobaseService } from '../data/grobase-services';

type Graph = GrobaseService[];

export interface PipelineHop {
	service: string;
	phase: 'request' | 'events';
	label: string;
	on: boolean;
}

// WHY: enabling a service in the figure must silently enable everything it
// needs, otherwise disabled dependencies would show behind a green check.
export function withDependencies(ids: Iterable<string>, services: Graph = SERVICES): Set<string> {
	const byId = indexById(services);
	const out = new Set<string>();
	const walk = (id: string) => {
		if (out.has(id)) return;
		out.add(id);
		byId.get(id)?.dependsOn.forEach(walk);
	};
	for (const id of ids) walk(id);
	return out;
}

// WHY: disabling a service must also disable every enabled service that needs
// it, because those would crash on a missing dependency. Returns a new Set.
export function withoutDependents(enabled: Set<string>, removed: string, services: Graph = SERVICES): Set<string> {
	const dependents = new Map<string, string[]>();
	for (const service of services) {
		for (const dep of service.dependsOn) {
			const list = dependents.get(dep) ?? [];
			list.push(service.id);
			dependents.set(dep, list);
		}
	}
	const doomed = new Set<string>();
	const stack = [removed];
	while (stack.length > 0) {
		const id = stack.pop() as string;
		if (doomed.has(id)) continue;
		doomed.add(id);
		for (const dependent of dependents.get(id) ?? []) stack.push(dependent);
	}
	return new Set([...enabled].filter((id) => !doomed.has(id)));
}

// WHY: profiles are how docker compose selects services, so the preset
// behaviour must match: any overlap enables the service, then dependencies close.
export function servicesForProfiles(profiles: string[], services: Graph = SERVICES): Set<string> {
	const all = profiles.includes('*');
	const matched = services
		.filter((service) => all || service.profiles.some((profile) => profiles.includes(profile)))
		.map((service) => service.id);
	return withDependencies(matched, services);
}

// WHY: an engine is only usable when both router hops run and the backing
// service (if any) is enabled; embedded engines need no backing service.
export function reachableEngines(enabled: Set<string>, services: Graph = SERVICES): string[] {
	if (!enabled.has('query-router') || !enabled.has('data-plane-router-rust')) return [];
	const byId = indexById(services);
	return ENGINES
		.filter((engine) => engine.service === null || (byId.has(engine.service) && enabled.has(engine.service)))
		.map((engine) => engine.id);
}

// Caveat: models only the universal query path (WAF → Kong → router → engine →
// outbox → webhooks), not the GoTrue, PostgREST or realtime direct routes that
// bypass it, and not per-engine execution semantics.
export function pipelineStatus(
	enabled: Set<string>,
	services: Graph = SERVICES,
): { hops: PipelineHop[]; engine: string | null; blockedAt: string | null; eventsBlockedAt: string | null } {
	const engine = firstReachableEngine(enabled, services);
	const engineDef = ENGINES.find((entry) => entry.id === engine);
	const engineService = engineDef?.service ?? null;
	// The engine hop follows the data plane: its backing service, or the data
	// plane itself for an embedded engine, or a marker when nothing is reachable.
	const engineHop = engine === null
		? { service: 'engine', label: 'Runs the query on an engine' }
		: {
			service: engineService ?? 'data-plane-router-rust',
			label: `Runs the query on ${engineDef?.label ?? 'engine'}`,
		};
	const hops: PipelineHop[] = [];
	let blockedAt: string | null = null;
	let eventsBlockedAt: string | null = null;
	const record = (service: string, phase: 'request' | 'events', label: string) => {
		const on = enabled.has(service);
		hops.push({ service, phase, label, on });
		if (!on && phase === 'request' && blockedAt === null) blockedAt = service;
		if (!on && phase === 'events' && eventsBlockedAt === null) eventsBlockedAt = service;
	};
	for (const hop of PIPELINE) {
		record(hop.service, hop.phase, hop.label);
		if (hop.service === 'data-plane-router-rust') record(engineHop.service, 'request', engineHop.label);
	}
	return { hops, engine, blockedAt, eventsBlockedAt };
}

// WHY: the figure narrates one path, so it names one engine — the first with a
// backing service wins, falling back to an embedded one.
function firstReachableEngine(enabled: Set<string>, services: Graph): string | null {
	const reachable = reachableEngines(enabled, services);
	const resolveEngineService = (id: string): string | null =>
		ENGINES.find((entry) => entry.id === id)?.service ?? null;
	const withService = reachable.find((id) => resolveEngineService(id) !== null);
	const embedded = reachable.find((id) => resolveEngineService(id) === null);
	return withService ?? embedded ?? null;
}

function indexById(services: Graph): Map<string, GrobaseService> {
	return new Map(services.map((service) => [service.id, service]));
}
