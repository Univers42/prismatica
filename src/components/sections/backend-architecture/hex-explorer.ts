// Driver for the hexagonal service explorer over the real grobase graph
// (src/data/grobase-services.ts via src/lib/service-graph.ts): DOM wiring and
// rendering only — no graph logic, no sentence copy.
// CSP: every runtime style value is written through el.style.setProperty.

import { motionAllowed } from '../../../lib/motion-preference';
import { ENGINES, PRESETS, SERVICES } from '../../../data/grobase-services';
import {
	pipelineStatus, reachableEngines, servicesForProfiles, withDependencies, withoutDependents,
} from '../../../lib/service-graph';
import { describeChange, eventsText, pathText } from '../../../lib/service-graph-copy';

const DESKTOP = matchMedia('(min-width: 1024px)');
const SVG_NS = 'http://www.w3.org/2000/svg';
const NAMES: Map<string, string> = new Map(SERVICES.map((service) => [service.id, service.name]));
const BY_ID: Map<string, (typeof SERVICES)[number]> = new Map(SERVICES.map((service) => [service.id, service]));

interface View {
	root: HTMLElement; board: HTMLElement; wires: SVGSVGElement; wire: SVGPathElement;
	pipeline: HTMLOListElement; detail: HTMLElement;
	chips: Map<string, HTMLButtonElement>; presets: Map<string, HTMLButtonElement>;
	dependentsOf: Map<string, string[]>;
}
// WHY: one mutable state object so every render helper sees the same truth.
interface State {
	enabled: Set<string>;
	copy: string;
}
interface Packet {
	el: SVGCircleElement | null;
	anim: Animation | null;
}

function resolveView(root: HTMLElement): View | null {
	const board = root.querySelector('.hex__board');
	const wires = root.querySelector('.hex__wires');
	const wire = wires?.querySelector('.hex__wire');
	const pipeline = root.querySelector('.hex__pipeline');
	const detail = root.querySelector('.hex__detail');
	if (!(board instanceof HTMLElement) || !(wires instanceof SVGSVGElement)
		|| !(wire instanceof SVGPathElement) || !(pipeline instanceof HTMLOListElement)
		|| !(detail instanceof HTMLElement)) return null;
	return { root, board, wires, wire, pipeline, detail,
		chips: collectButtons(root, '.hex__chip', 'data-service'),
		presets: collectButtons(root, '.hex__preset', 'data-preset'),
		dependentsOf: buildDependents() };
}

function collectButtons(root: HTMLElement, selector: string, attr: string): Map<string, HTMLButtonElement> {
	const found = new Map<string, HTMLButtonElement>();
	for (const button of root.querySelectorAll<HTMLButtonElement>(selector)) {
		const id = button.getAttribute(attr);
		if (id) found.set(id, button);
	}
	return found;
}

function buildDependents(): Map<string, string[]> {
	// Reverse index once per view: dep id → services that list it.
	const map = new Map<string, string[]>();
	for (const service of SERVICES) {
		for (const dep of service.dependsOn) {
			const list = map.get(dep) ?? [];
			list.push(service.id);
			map.set(dep, list);
		}
	}
	return map;
}

function span(className: string, text: string): HTMLSpanElement {
	const el = document.createElement('span');
	el.className = className;
	el.textContent = text;
	return el;
}

function renderAll(view: View, state: State, packet: Packet): void {
	renderChips(view, state);
	renderHud(view, state);
	renderPipeline(view, state);
	renderWires(view, state, packet);
}

function renderChips(view: View, state: State): void {	// Duplicate hops keep the first number; the 'engine' marker hop has no
	// chip, so unbacked engine hops never light one up.
	const hopIndex = new Map<string, string>();
	const status = pipelineStatus(state.enabled);
	status.hops.forEach((hop, index) => {
		if (view.chips.has(hop.service) && !hopIndex.has(hop.service)) hopIndex.set(hop.service, String(index + 1));
	});
	view.chips.forEach((chip, id) => {
		chip.setAttribute('aria-pressed', state.enabled.has(id) ? 'true' : 'false');
		if (hopIndex.has(id)) chip.setAttribute('data-hop', hopIndex.get(id) as string);
		else chip.removeAttribute('data-hop');
	});
}

function renderHud(view: View, state: State): void {
	const status = pipelineStatus(state.enabled);
	const set = (key: string, value: string) => {
		const el = view.root.querySelector(`[data-hud="${key}"]`);
		if (el) el.textContent = value;
	};
	set('running', `${state.enabled.size} of ${SERVICES.length}`);
	set('engines', `${reachableEngines(state.enabled).length} of ${ENGINES.length}`);
	set('path', pathText(status, NAMES));
	set('events', eventsText(status, NAMES));
}

function renderPipeline(view: View, state: State): void {
	const status = pipelineStatus(state.enabled);
	view.pipeline.replaceChildren();
	let phase: string | null = null;
	for (const [index, hop] of status.hops.entries()) {
		// The 'engine' marker hop has no chip and stays generic in copy.
		const name = hop.service === 'engine' ? 'Engine' : NAMES.get(hop.service) ?? hop.service;
		const item = document.createElement('li');
		if (phase !== null && hop.phase !== phase) item.setAttribute('data-phase-break', 'true');
		phase = hop.phase;
		item.setAttribute('data-on', hop.on ? 'true' : 'false');
		const blocked = hop.service === status.blockedAt || hop.service === status.eventsBlockedAt;
		item.setAttribute('data-blocked', blocked ? 'true' : 'false');
		item.append(
			span('hex__hop-num', String(index + 1)),
			span('hex__hop-name', name),
			span('hex__hop-label', hop.label),
			span('hex__hop-state', blocked ? 'blocked' : hop.on ? 'on' : 'off'),
		);
		view.pipeline.append(item);
	}
}

function toggleService(view: View, state: State, packet: Packet, id: string): void {
	const before = state.enabled;
	// Starting closes over dependencies; stopping pulls every enabled dependent
	// down with it (service-graph.ts enforces both).
	const after = before.has(id)
		? withoutDependents(before, id)
		: new Set([...before, ...withDependencies([id])]);
	state.enabled = after;
	view.presets.forEach((button) => button.setAttribute('aria-pressed', 'false'));
	state.copy = describeChange(before, after, id, NAMES);
	view.detail.textContent = state.copy;
	renderAll(view, state, packet);
}

function applyPreset(view: View, state: State, packet: Packet, id: string): void {
	const preset = PRESETS.find((entry) => entry.id === id);
	if (!preset) return;
	state.enabled = servicesForProfiles(preset.profiles);
	view.presets.forEach((button, pid) => button.setAttribute('aria-pressed', pid === id ? 'true' : 'false'));
	state.copy = `${preset.label}: ${state.enabled.size} of ${SERVICES.length} services running.`;
	view.detail.textContent = state.copy;
	renderAll(view, state, packet);
}

function transitive(from: string, neighboursOf: (id: string) => string[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>([from]);
	const walk = (id: string) => {
		for (const neighbour of neighboursOf(id)) {
			if (seen.has(neighbour)) continue;
			seen.add(neighbour);
			out.push(neighbour);
			walk(neighbour);
		}
	};
	walk(from);
	return out;
}

function listNames(ids: string[]): string {
	return ids.map((id) => NAMES.get(id) ?? id).join(', ');
}

function describeService(id: string, needs: string[], neededBy: string[]): string {
	const self = BY_ID.get(id);
	if (!self) return NAMES.get(id) ?? id;
	let text = `${self.name} — ${self.desc}`;
	if (needs.length > 0) text += ` Needs: ${listNames(needs)}.`;
	if (neededBy.length > 0) text += ` Needed by: ${listNames(neededBy)}.`;
	return text;
}

function previewService(view: View, id: string): void {
	const needs = transitive(id, (sid) => BY_ID.get(sid)?.dependsOn ?? []);
	const neededBy = transitive(id, (sid) => view.dependentsOf.get(sid) ?? []);
	view.chips.forEach((chip, chipId) => {
		if (chipId === id) return;
		if (needs.includes(chipId)) chip.setAttribute('data-needs', ''); else chip.removeAttribute('data-needs');
		if (neededBy.includes(chipId)) chip.setAttribute('data-needed-by', ''); else chip.removeAttribute('data-needed-by');
	});
	view.detail.textContent = describeService(id, needs, neededBy);
}

function clearPreview(view: View, state: State): void {
	view.chips.forEach((chip) => {
		chip.removeAttribute('data-needs');
		chip.removeAttribute('data-needed-by');
	});
	view.detail.textContent = state.copy;
}
function hopCentres(view: View, status: ReturnType<typeof pipelineStatus>): { x: number; y: number }[] {
	const boardRect = view.board.getBoundingClientRect();
	const seen = new Set<string>();
	const points: { x: number; y: number }[] = [];
	for (const hop of status.hops) {
		if (seen.has(hop.service)) continue;
		seen.add(hop.service);
		const chip = view.chips.get(hop.service);
		if (!chip) continue;
		const rect = chip.getBoundingClientRect();
		points.push({ x: rect.left - boardRect.left + rect.width / 2, y: rect.top - boardRect.top + rect.height / 2 });
	}
	return points;
}

// Straight hops, drawn under the chips: a smoothed curve through ten chips
// spread over six cells looped back on itself and crossed their labels.
function polyline(points: { x: number; y: number }[]): string {
	return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${Math.round(point.x)} ${Math.round(point.y)}`).join(' ');
}

function renderWires(view: View, state: State, packet: Packet): void {
	// WHY: cancel() rejects the animation's finished promise, so it is caught
	// here to keep re-renders free of unhandled rejections.
	const old = packet.anim;
	packet.anim = null;
	packet.el?.remove();
	packet.el = null;
	if (old) { old.finished.catch(() => {}); old.cancel(); }
	view.wires.removeAttribute('data-packet');
	if (!DESKTOP.matches) { view.wire.removeAttribute('d'); return; }
	const status = pipelineStatus(state.enabled);
	const complete = status.blockedAt === null;
	const points = hopCentres(view, status);
	if (points.length < 2) { view.wire.removeAttribute('d'); return; }
	const d = polyline(points);
	view.wire.setAttribute('d', d);
	view.wire.setAttribute('data-state', complete ? 'complete' : 'blocked');
	view.wires.setAttribute('viewBox', `0 0 ${Math.round(view.board.clientWidth)} ${Math.round(view.board.clientHeight)}`);
	// Caveat: the wire is recomputed on resize, not on font-load reflow.
	requestAnimationFrame(() => view.wire.setAttribute('data-drawn', 'true'));
	if (complete && motionAllowed()) startPacket(view, packet, d);
}

function startPacket(view: View, packet: Packet, d: string): void {
	const circle = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
	circle.setAttribute('class', 'hex__packet');
	circle.setAttribute('r', '4');
	circle.style.setProperty('offset-path', `path("${d}")`);
	circle.style.setProperty('offset-rotate', '0deg');
	view.wires.append(circle);
	packet.el = circle;
	packet.anim = circle.animate([{ offsetDistance: '0%' }, { offsetDistance: '100%' }],
		{ duration: 2400, delay: 900, easing: 'linear', iterations: Infinity });
	view.wires.setAttribute('data-packet', 'true');
}

export function initHexExplorer(): void {
	const root = document.querySelector('[data-hex]');
	if (!(root instanceof HTMLElement)) return;
	const view = resolveView(root);
	if (!view) return;
	const packet: Packet = { el: null, anim: null };
	const state: State = {
		enabled: servicesForProfiles((PRESETS.find((preset) => preset.id === 'query') ?? PRESETS[0]).profiles),
		copy: 'Pick a service to see what it needs.',
	};

	view.chips.forEach((chip, id) => {
		chip.addEventListener('click', () => toggleService(view, state, packet, id));
		chip.addEventListener('focus', () => previewService(view, id));
		chip.addEventListener('blur', () => clearPreview(view, state));
		chip.addEventListener('pointerenter', () => previewService(view, id));
		chip.addEventListener('pointerleave', () => clearPreview(view, state));
	});
	view.presets.forEach((button, id) => button.addEventListener('click', () => applyPreset(view, state, packet, id)));
	view.presets.get('query')?.setAttribute('aria-pressed', 'true');

	// WHY: the wire traces chip centres, so any board resize must re-trace it.
	let queued = false;
	const observer = new ResizeObserver(() => {
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => { queued = false; renderWires(view, state, packet); });
	});
	observer.observe(view.board);
	DESKTOP.addEventListener('change', () => renderWires(view, state, packet));
	renderAll(view, state, packet);
}
