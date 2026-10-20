// Deterministic geometry for the stack graph: the application core inside a
// hexagon, each adapter group on one side of an outer hexagon (driving
// adapters on the left, driven on the right), one-off jobs beside the service
// they prepare. Coordinates start at (0, 0) so the SVG view box and the CSS
// offset-path of the packets share one origin. No DOM access.

import { SERVICES, type GrobaseService, type ServiceGroup } from '../data/grobase-services';

export interface Point { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

export interface StackNode extends Point {
	id: string;
	label: string;
	group: ServiceGroup;
	job: boolean;
	r: number;
	// Unit vector the label is pushed along: down for the core, the side's
	// outward normal elsewhere, so labels on a slanted side clear the next node.
	out: Point;
}

export interface LabelPlacement {
	dx: number;
	dy: number;
	anchor: 'start' | 'middle' | 'end';
	baseline: 'hanging' | 'central' | 'text-after-edge';
}

export interface StackLayout {
	width: number;
	height: number;
	centre: Point;
	nodes: StackNode[];
	edges: { from: string; to: string; d: string }[];
	coreHex: string;
	outerHex: string;
	groups: { id: ServiceGroup; label: string; x: number; y: number; rotate: number }[];
	terminals: { id: 'clients' | 'subscribers'; label: string; x: number; y: number }[];
}

const SIDE_APOTHEM = 345;
const CORE_RADIUS = 270;
const OUTER_RADIUS = (2 * SIDE_APOTHEM) / Math.sqrt(3);
const GROUP_LABEL_APOTHEM = 287;
const MAX_SPACING = 80;
// Side ends stay this far from a corner: two neighbouring sides meet there.
const CORNER_CLEARANCE = 34;
const JOB_INSET = 24;
const JOB_SPREAD = 22;
// Room either side for outward labels and the two terminals; a label that
// still does not fit at the current size is dropped by visibleLabels.
const PAD_X = 200;
const PAD_Y = 40;

// Normals in degrees, SVG y pointing down. Each order runs along the side's
// tangent (the normal turned a quarter clockwise), so neighbours in the graph
// sit near each other and the request path crosses the hexagon once.
const SIDES: Record<Exclude<ServiceGroup, 'core'>, { normal: number; order: string[] }> = {
	edge: { normal: 180, order: ['realtime', 'postgrest', 'waf', 'kong', 'gotrue'] },
	tools: { normal: 240, order: ['vault42', 'playground', 'pg-meta', 'studio'] },
	control: { normal: 300, order: ['vault', 'supavisor', 'orchestrator', 'function-scheduler', 'tenant-control', 'adapter-registry-go', 'webhook-dispatcher'] },
	data: { normal: 0, order: ['iceberg-rest', 'trino', 'functions-runtime', 'data-plane-router-rust', 'debezium'] },
	engines: { normal: 60, order: ['postgres', 'mongo', 'redis', 'mysql', 'mariadb', 'mssql', 'cockroach', 'dynamodb-local', 'minio'] },
	ops: { normal: 120, order: ['pg-backup', 'loki', 'promtail', 'prometheus', 'grafana', 'mailpit'] },
};

const CORE: [string, number, number][] = [
	['email-service', -75, -150], ['schema-service', 75, -150],
	['newsletter-service', -150, -75], ['log-service', 0, -75], ['permission-engine', 150, -75],
	['session-service', -150, 0], ['query-router', 0, 0], ['gdpr-service', 150, 0],
	['ai-service', -150, 75], ['analytics-service', 0, 75], ['mongo-api', 150, 75],
	['storage-router', -90, 150], ['outbox-relay', 90, 150],
];

// Short forms of the GROUPS labels: on a phone the ring text must fit one
// hexagon side at a readable size.
const GROUP_LABELS: Record<ServiceGroup, string> = {
	core: 'Application core', edge: 'Edge', tools: 'Studio', control: 'Control plane',
	data: 'Data plane', engines: 'Engines', ops: 'Observability',
};

const unit = (degrees: number): Point => {
	const radians = (degrees * Math.PI) / 180;
	return { x: Math.cos(radians), y: Math.sin(radians) };
};
const round = (value: number) => Math.round(value * 10) / 10;
const shortLabel = (service: GrobaseService) => service.name.replace(/ service$/, '');

function hexPoints(radius: number, origin: Point): string {
	return [-90, -30, 30, 90, 150, 210]
		.map((angle) => unit(angle))
		.map((p) => `${round(origin.x + p.x * radius)},${round(origin.y + p.y * radius)}`)
		.join(' ');
}

function placeSides(byId: Map<string, GrobaseService>): StackNode[] {
	const usable = OUTER_RADIUS - 2 * CORNER_CLEARANCE;
	const nodes: StackNode[] = [];
	for (const [group, { normal, order }] of Object.entries(SIDES)) {
		const n = unit(normal);
		const t = unit(normal + 90);
		const spacing = Math.min(MAX_SPACING, usable / (order.length - 1));
		order.forEach((id, index) => {
			const u = (index - (order.length - 1) / 2) * spacing;
			const service = byId.get(id) as GrobaseService;
			nodes.push({
				id, label: shortLabel(service), group: group as ServiceGroup, job: false, r: 9,
				x: round(n.x * SIDE_APOTHEM + t.x * u), y: round(n.y * SIDE_APOTHEM + t.y * u),
				out: n,
			});
		});
	}
	return nodes;
}

// Jobs hang just inside their parent, fanned along the side.
function placeJobs(parents: Map<string, StackNode>): StackNode[] {
	const jobs = SERVICES.filter((service) => service.kind === 'job');
	return jobs.map((job) => {
		const parent = parents.get(job.parent as string) as StackNode;
		const siblings = jobs.filter((other) => other.parent === job.parent);
		const offset = (siblings.indexOf(job) - (siblings.length - 1) / 2) * JOB_SPREAD;
		const normal = Object.values(SIDES).find((side) => side.order.includes(parent.id))?.normal ?? 0;
		const n = unit(normal);
		const t = unit(normal + 90);
		return {
			id: job.id, label: shortLabel(job), group: job.group, job: true, r: 5, out: parent.out,
			x: round(parent.x - n.x * JOB_INSET + t.x * offset), y: round(parent.y - n.y * JOB_INSET + t.y * offset),
		};
	});
}

// One quadratic per hop, its control point pulled toward the centre so every
// wire bows around the core instead of cutting straight through labels.
function curve(from: Point, to: Point, centre: Point): string {
	const cx = round((from.x + to.x) / 2 + (centre.x - (from.x + to.x) / 2) * 0.35);
	const cy = round((from.y + to.y) / 2 + (centre.y - (from.y + to.y) / 2) * 0.35);
	return `Q ${cx} ${cy} ${to.x} ${to.y}`;
}

export function routePath(points: Point[], centre: Point): string {
	const [first, ...rest] = points;
	if (!first) return '';
	let previous = first;
	const segments = rest.map((point) => {
		const segment = curve(previous, point, centre);
		previous = point;
		return segment;
	});
	return [`M ${first.x} ${first.y}`, ...segments].join(' ');
}

export function layoutStack(): StackLayout {
	const byId = new Map(SERVICES.map((service) => [service.id, service]));
	const core = CORE.map(([id, x, y]): StackNode => ({
		id, x, y, label: shortLabel(byId.get(id) as GrobaseService), group: 'core', job: false,
		r: id === 'query-router' ? 14 : 10, out: { x: 0, y: 1 },
	}));
	const sides = placeSides(byId);
	const jobs = placeJobs(new Map(sides.map((entry) => [entry.id, entry])));
	const raw = [...core, ...sides, ...jobs];
	const xs = raw.map((entry) => entry.x);
	const ys = raw.map((entry) => entry.y);
	const dx = PAD_X - Math.min(...xs);
	const dy = PAD_Y + 30 - Math.min(...ys);
	const nodes = raw.map((entry) => ({ ...entry, x: round(entry.x + dx), y: round(entry.y + dy) }));
	const centre = { x: round(dx), y: round(dy) };
	const position = new Map(nodes.map((entry) => [entry.id, entry]));
	const edges = SERVICES.flatMap((service) => service.dependsOn.map((dep) => {
		const from = position.get(service.id) as StackNode;
		const to = position.get(dep) as StackNode;
		return { from: service.id, to: dep, d: `M ${from.x} ${from.y} ${curve(from, to, centre)}` };
	}));
	const groups = (Object.keys(GROUP_LABELS) as ServiceGroup[]).map((id) => {
		if (id === 'core') return { id, label: GROUP_LABELS[id], x: centre.x, y: round(centre.y - 192), rotate: 0 };
		const normal = SIDES[id].normal;
		const n = unit(normal);
		// Text runs along the side, never upside down; on the two upright
		// sides its top faces outward.
		const along = (normal % 180) - 90;
		const rotate = along === -90 && n.x > 0 ? 90 : along;
		return { id, label: GROUP_LABELS[id], x: round(centre.x + n.x * GROUP_LABEL_APOTHEM), y: round(centre.y + n.y * GROUP_LABEL_APOTHEM), rotate };
	});
	// Subscribers sit in the empty top-right corner, clear of the control
	// side's labels, where the events route leaves the hexagon.
	const terminals: StackLayout['terminals'] = [
		{ id: 'clients', label: 'Clients', x: round(centre.x - SIDE_APOTHEM - 170), y: centre.y },
		{ id: 'subscribers', label: 'Subscribers', x: round(centre.x + SIDE_APOTHEM + 110), y: round(centre.y - OUTER_RADIUS + 60) },
	];
	return {
		width: round(Math.max(...xs) + dx + PAD_X), height: round(Math.max(...ys) + dy + PAD_Y),
		centre, nodes, edges, groups, terminals,
		coreHex: hexPoints(CORE_RADIUS, centre), outerHex: hexPoints(OUTER_RADIUS, centre),
	};
}

// `mirrored` swaps the label to the inward side, for a focused service whose
// outward label would leave the screen.
export function labelPlacement(node: StackNode, mirrored = false): LabelPlacement {
	const gap = node.r + 4;
	const outX = mirrored ? -node.out.x : node.out.x;
	const anchor = outX > 0.1 ? 'start' : outX < -0.1 ? 'end' : 'middle';
	const baseline = node.out.y > 0.1 ? 'hanging' : node.out.y < -0.1 ? 'text-after-edge' : 'central';
	return { dx: round(outX * gap), dy: round(node.out.y * gap), anchor, baseline };
}

// Caveat: text width is estimated per character from Space Grotesk measured
// in Chrome on 2026-10-20 (lowercase ~0.53 em, capitals up to 0.68 em). A
// fallback font or a run of wide letters (m, w) can still be a few percent
// wider than estimated; the 4-unit gap between boxes absorbs that.
function textWidth(text: string, size: number): number {
	let em = 0;
	for (const char of text) em += char === ' ' ? 0.27 : char === char.toUpperCase() && char !== char.toLowerCase() ? 0.68 : 0.56;
	return em * size;
}

export function labelBox(node: StackNode, size: number, mirrored = false): Box {
	const w = textWidth(node.label, size);
	const h = size * 1.2;
	const place = labelPlacement(node, mirrored);
	const ax = node.x + place.dx;
	const ay = node.y + place.dy;
	const x = place.anchor === 'start' ? ax : place.anchor === 'end' ? ax - w : ax - w / 2;
	const y = place.baseline === 'hanging' ? ay : place.baseline === 'text-after-edge' ? ay - h : ay - h / 2;
	return { x, y, w, h };
}

// Terminal glyphs are 26 x 20 with their label above, drawn at the group
// label size (10 px on screen against 11 px for node labels).
export const TERMINAL_LABEL_RISE = 14;
export function terminalBoxes(terminal: StackLayout['terminals'][number], size: number): Box[] {
	const labelSize = (size * 10) / 11;
	const w = textWidth(terminal.label, labelSize);
	const h = labelSize * 1.2;
	const x = terminal.id === 'clients' ? terminal.x - 14 : terminal.x + 14 - w;
	return [
		{ x: terminal.x - 13, y: terminal.y - 10, w: 26, h: 20 },
		{ x, y: terminal.y - TERMINAL_LABEL_RISE - h, w, h },
	];
}

const GAP = 4;
const hits = (a: Box, b: Box) =>
	a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;

// Greedy level of detail: labels are tried in priority order and kept only
// when they fit inside the view box without touching a kept label or another
// node, so a phone shows the few that matter and a wide screen shows all.
// `focus` labels (hover, selection) go first, may cross another node's dot
// (their halo keeps them legible) and flip inward when outward runs off the
// view box; they still never cover a label. Returns id -> mirrored, in order.
export function visibleLabels(layout: StackLayout, order: string[], size: number, focus: string[] = []): Map<string, boolean> {
	const byId = new Map(layout.nodes.map((entry) => [entry.id, entry]));
	const discs = layout.nodes.map((entry) => ({ id: entry.id, box: { x: entry.x - entry.r, y: entry.y - entry.r, w: entry.r * 2, h: entry.r * 2 } }));
	const kept: Box[] = layout.terminals.flatMap((terminal) => terminalBoxes(terminal, size));
	const shown = new Map<string, boolean>();
	const fits = (id: string, box: Box) => box.x >= 0 && box.y >= 0 && box.x + box.w <= layout.width && box.y + box.h <= layout.height
		&& !kept.some((other) => hits(box, other))
		&& (focus.includes(id) || !discs.some((disc) => disc.id !== id && hits(box, disc.box)));
	for (const id of [...focus, ...order]) {
		const entry = byId.get(id);
		if (!entry || shown.has(id)) continue;
		const tries = focus.includes(id) ? [false, true] : [false];
		const mirrored = tries.find((flip) => fits(id, labelBox(entry, size, flip)));
		if (mirrored === undefined) continue;
		kept.push(labelBox(entry, size, mirrored));
		shown.set(id, mirrored);
	}
	return shown;
}

const DIRECTIONS: Record<string, Point> = {
	ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
};

// Arrow keys move to the closest node within 60 degrees of the key's
// direction; sideways distance costs double so straight lines win.
export function nearestInDirection(nodes: StackNode[], fromId: string, key: string): string {
	const from = nodes.find((entry) => entry.id === fromId);
	const direction = DIRECTIONS[key];
	if (!from || !direction) return fromId;
	let best = fromId;
	let bestScore = Infinity;
	for (const entry of nodes) {
		const along = (entry.x - from.x) * direction.x + (entry.y - from.y) * direction.y;
		const across = Math.abs((entry.x - from.x) * direction.y - (entry.y - from.y) * direction.x);
		if (entry.id === fromId || along <= 0 || across > along * Math.sqrt(3)) continue;
		const score = along + across * 2;
		if (score < bestScore) { bestScore = score; best = entry.id; }
	}
	return best;
}
