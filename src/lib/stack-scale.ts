// Replica counts per load level and the Mermaid source of the scaling
// diagram, both derived from the chart facts in data/stack-scale.ts so the
// drawing, the numbers and the copyable source cannot disagree. No DOM access.

import { CPU_TARGET, LINKS, PLANES, type LoadLevel, type Plane } from '../data/stack-scale';

// Caveat: 'busy' is the midpoint of the autoscaler's range, an illustration
// of where it may sit under load, not a measured replica count.
export function replicasAt(plane: Plane, level: LoadLevel): number {
	if (plane.kind === 'entry') return 0;
	if (level === 'laptop') return 1;
	if (level === 'quiet') return plane.min;
	if (level === 'peak') return plane.max;
	return Math.round((plane.min + plane.max) / 2);
}

export function totalPods(level: LoadLevel): number {
	return PLANES.reduce((sum, plane) => sum + replicasAt(plane, level), 0);
}

export function scaleNote(plane: Plane): string {
	if (plane.kind === 'autoscaled') return `HPA ${plane.min}–${plane.max}`;
	if (plane.kind === 'manual') return `Fixed, ${plane.min}`;
	if (plane.kind === 'stateful') return `StatefulSet, ${plane.min}`;
	return '';
}

function declare(plane: Plane): string {
	const note = scaleNote(plane);
	const text = note ? `${plane.name}<br/>${note}` : plane.name;
	if (plane.kind === 'stateful') return `${plane.id}[("${text}")]`;
	if (plane.id === 'clients') return `${plane.id}(["${text}"])`;
	return `${plane.id}["${text}"]`;
}

const idsOf = (kind: Plane['kind']) => PLANES.filter((plane) => plane.kind === kind).map((plane) => plane.id).join(',');

export function mermaidSource(): string {
	const lines = [
		'flowchart TD',
		...PLANES.map((plane) => `  ${declare(plane)}`),
		...LINKS.map(([from, to]) => `  ${from} --> ${to}`),
		`  classDef hpa stroke-width:2px`,
		'  classDef manual stroke-dasharray:4 3',
		'  classDef state fill:#f3f3f3',
		`  class ${idsOf('autoscaled')} hpa`,
		`  class ${idsOf('manual')} manual`,
		`  class ${idsOf('stateful')} state`,
		`  %% HPA target: ${CPU_TARGET}% average CPU. Every other connection is denied by NetworkPolicy.`,
	];
	return `${lines.join('\n')}\n`;
}
