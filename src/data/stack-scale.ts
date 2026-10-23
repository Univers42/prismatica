// How grobase scales on Kubernetes, read on 2026-10-20 from the Helm chart in
// /opt/grobase/deploy/helm/grobase (values.yaml, templates/networkpolicy.yaml).
// Replica ranges and the 70% CPU target are the chart's settings, not
// measurements. Every link is an allow rule of the chart's NetworkPolicy,
// which denies all other traffic inside the namespace.

export type PlaneKind = 'entry' | 'autoscaled' | 'manual' | 'stateful';

export interface Plane {
	id: string;
	name: string;
	kind: PlaneKind;
	min: number;
	max: number;
}

export const CPU_TARGET = 70;

export const PLANES: Plane[] = [
	{ id: 'clients', name: 'Clients', kind: 'entry', min: 0, max: 0 },
	{ id: 'ingress', name: 'Ingress', kind: 'entry', min: 0, max: 0 },
	{ id: 'kong', name: 'Kong gateway', kind: 'autoscaled', min: 2, max: 8 },
	{ id: 'realtime', name: 'Realtime', kind: 'manual', min: 2, max: 2 },
	{ id: 'data', name: 'Rust data plane', kind: 'autoscaled', min: 2, max: 10 },
	{ id: 'redis', name: 'Redis', kind: 'stateful', min: 1, max: 1 },
	{ id: 'tenant', name: 'Tenant control', kind: 'autoscaled', min: 2, max: 6 },
	{ id: 'registry', name: 'Adapter registry', kind: 'autoscaled', min: 2, max: 6 },
	{ id: 'postgres', name: 'PostgreSQL', kind: 'stateful', min: 1, max: 1 },
];

// Caller first. A subset of the allow rules: the request path and realtime.
export const LINKS: [string, string][] = [
	['clients', 'ingress'],
	['ingress', 'kong'],
	['kong', 'data'],
	['kong', 'realtime'],
	['data', 'redis'],
	['data', 'tenant'],
	['data', 'registry'],
	['tenant', 'registry'],
	['tenant', 'postgres'],
	['registry', 'postgres'],
	['realtime', 'postgres'],
];

export type LoadLevel = 'laptop' | 'quiet' | 'busy' | 'peak';

export const LEVELS: { id: LoadLevel; label: string; caption: string }[] = [
	{ id: 'laptop', label: 'Laptop', caption: 'One container per service with docker compose: the same images, no cluster to run.' },
	{ id: 'quiet', label: 'Quiet', caption: 'The chart’s floor: two of every stateless plane, so losing a pod never takes the API down.' },
	{ id: 'busy', label: 'Busy', caption: 'Illustrative midpoint: the autoscaler adds pods while average CPU stays above 70%.' },
	{ id: 'peak', label: 'Peak', caption: 'The chart’s ceiling. Postgres and Redis stay single: more needs an operator or a managed service.' },
];
