// Pure sentence helpers for the hexagonal service explorer. Every branch of
// the explorer's live-region copy lives here so the wording is testable
// without a DOM. No numbers are invented: counts are taken from the sets.
// WHY: <p aria-live> copy written inline in the app script is untestable and
// drifts; wording is part of the feature contract.

import type { PipelineHop } from './service-graph';

// Structural subset of the object returned by `pipelineStatus` so the copy
// helpers stay decoupled from the graph internals.
interface StatusShape {
	blockedAt: string | null;
	eventsBlockedAt: string | null;
	hops: PipelineHop[];
}

const nameOf = (id: string, names: Map<string, string>): string => names.get(id) ?? id;

// WHY: the live region is read aloud, so long dependency lists are compressed
// to two names and a count instead of reading 27 service names.
export function describeChange(
	before: Set<string>,
	after: Set<string>,
	target: string,
	names: Map<string, string>,
): string {
	const label = nameOf(target, names);
	if (after.has(target) && !before.has(target)) return describeStart(before, after, target, label, names);
	if (!after.has(target) && before.has(target)) return describeStop(before, after, target, label);
	return 'Nothing changed.';
}

function describeStart(
	before: Set<string>,
	after: Set<string>,
	target: string,
	label: string,
	names: Map<string, string>,
): string {
	const gained = [...after]
		.filter((id) => id !== target && !before.has(id))
		.map((id) => nameOf(id, names));
	if (gained.length === 0) return `Started ${label}.`;
	if (gained.length === 1) return `Started ${label} with ${gained[0]}.`;
	if (gained.length === 2) return `Started ${label} with ${gained[0]} and ${gained[1]}.`;
	return `Started ${label} with ${gained[0]}, ${gained[1]} and ${gained.length - 2} more.`;
}

function describeStop(before: Set<string>, after: Set<string>, target: string, label: string): string {
	// Stops stay short: the count of pulled-down dependents reads better aloud
	// than a list of up to two dozen names.
	const lost = [...before].filter((id) => id !== target && !after.has(id));
	if (lost.length === 0) return `Stopped ${label}.`;
	return `Stopped ${label} and ${lost.length} services that need it.`;
}

export function pathText(status: StatusShape, names: Map<string, string>): string {
	if (status.blockedAt !== null) return `Blocked at ${nameOf(status.blockedAt, names)}`;
	const request = status.hops.filter((hop) => hop.phase === 'request');
	const engineHop = request[request.length - 1];
	// WHY: the last request hop is the inserted engine hop, so its service is
	// what actually serves the query (or the data plane for embedded engines).
	return `Complete: served by ${nameOf(engineHop?.service ?? 'engine', names)}`;
}

export function eventsText(status: StatusShape, names: Map<string, string>): string {
	if (status.eventsBlockedAt === null) return 'Delivered as signed webhooks';
	return `Not delivered: ${nameOf(status.eventsBlockedAt, names)} is off`;
}
