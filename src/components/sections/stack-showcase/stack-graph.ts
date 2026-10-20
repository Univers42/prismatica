// Driver for the live stack graph (StackGraph.astro): selection, start/stop,
// presets, labels that fit the screen, and packets along the request path.
// Graph rules live in lib/service-graph.ts, geometry in lib/stack-layout.ts,
// sentences in lib/service-graph-copy.ts; this file only touches the DOM.
// CSP: runtime style values go through style.setProperty.

import { ENGINES, GROUPS, PRESETS, SERVICES } from '../../../data/grobase-services';
import { motionAllowed } from '../../../lib/motion-preference';
import {
	dependencyDepth, pipelineRoute, pipelineStatus, reachableEngines, servicesForProfiles, withDependencies, withoutDependents,
} from '../../../lib/service-graph';
import { describeChange, eventsText, pathText, shortList } from '../../../lib/service-graph-copy';
import { labelPlacement, layoutStack, nearestInDirection, routePath, visibleLabels, type Point } from '../../../lib/stack-layout';

const SVG_NS = 'http://www.w3.org/2000/svg';
const LAYOUT = layoutStack();
const NAMES = new Map(SERVICES.map((service) => [service.id, service.name]));
const BY_ID = new Map(SERVICES.map((service) => [service.id, service]));
const GROUP_NAMES = new Map<string, string>(GROUPS.map((group) => [group.id, group.label]));
const NODES = new Map(LAYOUT.nodes.map((node) => [node.id, node]));
const POINTS = new Map<string, Point>([...LAYOUT.nodes, ...LAYOUT.terminals].map((entry) => [entry.id, entry]));
const DEPENDENTS = new Map<string, string[]>();
for (const service of SERVICES) {
	for (const dep of service.dependsOn) DEPENDENTS.set(dep, [...(DEPENDENTS.get(dep) ?? []), service.id]);
}
const LABEL_PX = 11;
const HIT_PX = 26;
const PACKET_UNITS_PER_S = 420;
const BUILD_STEP_MS = 150;
const KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'Enter', ' ']);

type Status = ReturnType<typeof pipelineStatus>;
interface View {
	svg: SVGSVGElement; nodes: Map<string, SVGGElement>; edges: SVGPathElement[];
	request: SVGPathElement; events: SVGPathElement; packets: SVGGElement;
	root: HTMLElement; toggle: HTMLButtonElement; presets: Map<string, HTMLButtonElement>; status: HTMLElement;
}
interface State {
	enabled: Set<string>; pipeline: Status; selected: string; hover: string | null;
	k: number; active: boolean; packets: Animation[];
}

function resolveView(root: HTMLElement): View | null {
	const svg = root.querySelector('[data-graph]');
	const request = root.querySelector('[data-route="request"]');
	const events = root.querySelector('[data-route="events"]');
	const packets = root.querySelector('.stack-graph__packets');
	const toggle = root.querySelector('[data-toggle]');
	const status = root.querySelector('[data-status]');
	if (!(svg instanceof SVGSVGElement) || !(request instanceof SVGPathElement) || !(events instanceof SVGPathElement)
		|| !(packets instanceof SVGGElement) || !(toggle instanceof HTMLButtonElement) || !(status instanceof HTMLElement)) return null;
	const nodes = new Map([...svg.querySelectorAll<SVGGElement>('[data-node]')].map((node) => [node.dataset.node ?? '', node]));
	const presets = new Map([...root.querySelectorAll<HTMLButtonElement>('[data-preset]')].map((button) => [button.dataset.preset ?? '', button]));
	return { svg, nodes, edges: [...svg.querySelectorAll<SVGPathElement>('.stack-graph__edge')], request, events, packets, root, toggle, presets, status };
}

function setText(root: HTMLElement, selector: string, text: string): void {
	const el = root.querySelector(selector);
	if (el) el.textContent = text;
}

function renderGraph(view: View, state: State): void {
	const { request, events } = pipelineRoute(state.pipeline);
	if (state.pipeline.blockedAt === null && state.pipeline.eventsBlockedAt === null) events.push('subscribers');
	const blocked = new Set([state.pipeline.blockedAt, state.pipeline.eventsBlockedAt]);
	view.nodes.forEach((node, id) => {
		const on = state.enabled.has(id);
		node.toggleAttribute('data-on', on);
		node.toggleAttribute('data-hop', on && (request.includes(id) || events.includes(id)));
		node.toggleAttribute('data-blocked', blocked.has(id) && (request.includes(id) || events.includes(id)));
		const service = BY_ID.get(id);
		node.setAttribute('aria-label', `${service?.name}, ${GROUP_NAMES.get(service?.group ?? '')}, ${on ? 'running' : 'stopped'}`);
	});
	for (const edge of view.edges) {
		edge.toggleAttribute('data-off', !state.enabled.has(edge.dataset.from ?? '') || !state.enabled.has(edge.dataset.to ?? ''));
	}
	const points = (ids: string[]) => ids.map((id) => POINTS.get(id)).filter((point): point is Point => point !== undefined);
	view.request.setAttribute('d', routePath(points(['clients', ...request]), LAYOUT.centre));
	view.events.setAttribute('d', events.length > 1 ? routePath(points(events), LAYOUT.centre) : '');
	setText(view.root, '[data-hud="running"]', `${state.enabled.size} of ${SERVICES.length}`);
	setText(view.root, '[data-hud="engines"]', `${reachableEngines(state.enabled).length} of ${ENGINES.length}`);
	setText(view.root, '[data-hud="path"]', pathText(state.pipeline, NAMES));
	setText(view.root, '[data-hud="events"]', eventsText(state.pipeline, NAMES));
	startPackets(view, state);
}

function renderFocus(view: View, state: State): void {
	const focus = state.hover ?? state.selected;
	const needs = new Set(BY_ID.get(focus)?.dependsOn ?? []);
	const neededBy = new Set(DEPENDENTS.get(focus) ?? []);
	view.nodes.forEach((node, id) => {
		node.setAttribute('aria-selected', String(id === state.selected));
		node.toggleAttribute('data-hover', id === state.hover);
		if (needs.has(id) || neededBy.has(id)) node.setAttribute('data-rel', needs.has(id) ? 'needs' : 'needed-by');
		else node.removeAttribute('data-rel');
	});
	for (const edge of view.edges) {
		const rel = edge.dataset.from === focus ? 'needs' : edge.dataset.to === focus ? 'needed-by' : null;
		if (rel) edge.setAttribute('data-rel', rel); else edge.removeAttribute('data-rel');
	}
	view.svg.toggleAttribute('data-hover', state.hover !== null);
	view.svg.setAttribute('aria-activedescendant', `stack-node-${state.selected}`);
	renderCard(view, state);
	renderLabels(view, state);
}

function renderCard(view: View, state: State): void {
	const service = BY_ID.get(state.selected);
	if (!service) return;
	const on = state.enabled.has(service.id);
	setText(view.root, '[data-card="kind"]', `${GROUP_NAMES.get(service.group)}${service.kind === 'job' ? ', one-off job' : ''}`);
	setText(view.root, '[data-card="name"]', service.name);
	setText(view.root, '[data-card="state"]', on ? 'Running' : 'Stopped');
	view.root.querySelector('[data-card="state"]')?.toggleAttribute('data-on', on);
	setText(view.root, '[data-card="desc"]', service.desc);
	setText(view.root, '[data-card="needs"]', shortList(service.dependsOn, NAMES));
	setText(view.root, '[data-card="needed-by"]', shortList(DEPENDENTS.get(service.id) ?? [], NAMES));
	view.toggle.textContent = `${on ? 'Stop' : 'Start'} ${service.name}`;
}

// The hovered and selected services label first, then the request path,
// then everything else as room allows at the current screen size.
function renderLabels(view: View, state: State): void {
	const focus = [state.hover, state.selected].filter((id): id is string => id !== null);
	const order = [...state.pipeline.hops.map((hop) => hop.service), ...LAYOUT.nodes.filter((node) => !node.job).map((node) => node.id)];
	const shown = visibleLabels(LAYOUT, order, LABEL_PX * state.k, focus);
	view.nodes.forEach((node, id) => {
		node.toggleAttribute('data-label', shown.has(id));
		const mirrored = shown.get(id) === true;
		if (node.hasAttribute('data-mirrored') === mirrored) return;
		node.toggleAttribute('data-mirrored', mirrored);
		const text = node.querySelector('.stack-graph__label');
		const entry = NODES.get(id);
		if (!text || !entry) return;
		const place = labelPlacement(entry, mirrored);
		text.setAttribute('x', String(place.dx));
		text.setAttribute('text-anchor', place.anchor);
	});
}

function startPackets(view: View, state: State): void {
	state.packets.forEach((animation) => animation.cancel());
	state.packets = [];
	view.packets.replaceChildren();
	if (!motionAllowed() || !CSS.supports('offset-path', 'path("M 0 0 L 1 1")')) return;
	for (const [path, count] of [[view.request, 2], [view.events, 1]] as const) {
		const d = path.getAttribute('d');
		if (!d) continue;
		const duration = Math.max(1400, (path.getTotalLength() / PACKET_UNITS_PER_S) * 1000);
		for (let index = 0; index < count; index += 1) {
			const dot = document.createElementNS(SVG_NS, 'circle');
			dot.setAttribute('class', 'stack-graph__packet');
			dot.setAttribute('r', String(Math.round(4.5 * state.k)));
			dot.style.setProperty('offset-path', `path("${d}")`);
			view.packets.append(dot);
			// A negative delay starts each packet part-way along the route.
			const animation = dot.animate([{ offsetDistance: '0%' }, { offsetDistance: '100%' }],
				{ duration, delay: (-index * duration) / count, iterations: Infinity, easing: 'ease-in-out' });
			if (!state.active) animation.pause();
			state.packets.push(animation);
		}
	}
}

function changeEnabled(view: View, state: State, after: Set<string>, copy: string): void {
	state.enabled = after;
	state.pipeline = pipelineStatus(after);
	view.status.textContent = copy;
	renderGraph(view, state);
	renderFocus(view, state);
}

// Starting closes over dependencies; stopping pulls every running dependent
// down with it (service-graph.ts enforces both).
function toggleService(view: View, state: State, id: string): void {
	const before = state.enabled;
	const after = before.has(id) ? withoutDependents(before, id) : new Set([...before, ...withDependencies([id])]);
	view.presets.forEach((button) => button.setAttribute('aria-pressed', 'false'));
	changeEnabled(view, state, after, describeChange(before, after, id, NAMES));
}

function applyPreset(view: View, state: State, id: string): void {
	const preset = PRESETS.find((entry) => entry.id === id);
	if (!preset) return;
	view.presets.forEach((button, presetId) => button.setAttribute('aria-pressed', String(presetId === id)));
	const after = servicesForProfiles(preset.profiles);
	changeEnabled(view, state, after, `${preset.label}: ${after.size} of ${SERVICES.length} services running.`);
}

function nodeAt(view: View, state: State, event: MouseEvent): string | null {
	const matrix = view.svg.getScreenCTM();
	if (!matrix) return null;
	const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
	let best: string | null = null;
	let bestDistance = HIT_PX * state.k;
	for (const node of LAYOUT.nodes) {
		const distance = Math.hypot(node.x - point.x, node.y - point.y) - node.r;
		if (distance < bestDistance) { bestDistance = distance; best = node.id; }
	}
	return best;
}

function onKey(view: View, state: State, event: KeyboardEvent): void {
	if (!KEYS.has(event.key)) return;
	event.preventDefault();
	if (event.key === 'Enter' || event.key === ' ') { toggleService(view, state, state.selected); return; }
	state.selected = event.key === 'Home' ? 'query-router' : nearestInDirection(LAYOUT.nodes, state.selected, event.key);
	renderFocus(view, state);
}

function measure(view: View, state: State): void {
	const width = view.svg.getBoundingClientRect().width;
	if (width === 0) return;
	state.k = LAYOUT.width / width;
	view.svg.style.setProperty('--graph-k', state.k.toFixed(3));
	view.svg.style.setProperty('--graph-label', `${(LABEL_PX * state.k).toFixed(1)}px`);
	view.packets.querySelectorAll('circle').forEach((dot) => dot.setAttribute('r', String(Math.round(4.5 * state.k))));
	renderLabels(view, state);
}

// Each service appears one step after its deepest dependency, the order
// compose starts them in; a wire draws once both of its ends exist.
function prepareBuild(view: View): number {
	const depth = dependencyDepth();
	const step = (id: string) => (depth.get(id) ?? 0) * BUILD_STEP_MS;
	let last = 0;
	[...view.nodes.entries()].forEach(([id, node], index) => {
		const delay = step(id) + (index % 7) * 18;
		last = Math.max(last, delay);
		node.style.setProperty('--d', `${delay}ms`);
	});
	for (const edge of view.edges) {
		const delay = Math.max(step(edge.dataset.from ?? ''), step(edge.dataset.to ?? '')) + BUILD_STEP_MS;
		edge.style.setProperty('--d', `${delay}ms`);
		edge.style.setProperty('--len', String(Math.ceil(edge.getTotalLength())));
	}
	for (const route of [view.request, view.events]) {
		route.style.setProperty('--d', `${last + 2 * BUILD_STEP_MS}ms`);
		route.style.setProperty('--len', String(Math.ceil(route.getAttribute('d') ? route.getTotalLength() : 0)));
	}
	return last + 1200;
}

function bindPointer(view: View, state: State): void {
	view.svg.addEventListener('click', (event) => {
		const id = nodeAt(view, state, event);
		if (!id) return;
		state.selected = id;
		renderFocus(view, state);
	});
	view.svg.addEventListener('pointermove', (event) => {
		if (event.pointerType !== 'mouse') return;
		const id = nodeAt(view, state, event);
		if (id === state.hover) return;
		state.hover = id;
		renderFocus(view, state);
	});
	view.svg.addEventListener('pointerleave', () => {
		if (state.hover === null) return;
		state.hover = null;
		renderFocus(view, state);
	});
}

export function bindStackGraph(root: HTMLElement): { setActive: (active: boolean) => void } | null {
	const view = resolveView(root);
	if (!view) return null;
	const preset = PRESETS.find((entry) => entry.id === 'query') ?? PRESETS[0]!;
	const enabled = servicesForProfiles(preset.profiles);
	const state: State = { enabled, pipeline: pipelineStatus(enabled), selected: 'query-router', hover: null, k: 2, active: false, packets: [] };

	bindPointer(view, state);
	view.svg.addEventListener('keydown', (event) => onKey(view, state, event));
	view.toggle.addEventListener('click', () => toggleService(view, state, state.selected));
	view.presets.forEach((button, id) => button.addEventListener('click', () => applyPreset(view, state, id)));
	new ResizeObserver(() => measure(view, state)).observe(view.svg);
	renderGraph(view, state);
	renderFocus(view, state);
	measure(view, state);

	let built = !motionAllowed();
	const buildMs = built ? 0 : prepareBuild(view);
	if (!built) view.svg.dataset.build = 'pending';
	let visible = false;
	const sync = () => {
		const running = state.active && visible;
		state.packets.forEach((animation) => (running ? animation.play() : animation.pause()));
		if (!running || built) return;
		built = true;
		view.svg.dataset.build = 'run';
		window.setTimeout(() => { view.svg.dataset.build = 'done'; }, buildMs);
	};
	new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? false; sync(); }, { threshold: 0.3 }).observe(view.svg);
	return { setActive: (active: boolean) => { state.active = active; sync(); } };
}
