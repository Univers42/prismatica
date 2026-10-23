import { describe, expect, it } from 'vitest';
import { SERVICES } from '../../../src/data/grobase-services';
import {
	labelBox, layoutStack, nearestInDirection, routePath, terminalBoxes, visibleLabels, type Box,
} from '../../../src/lib/stack-layout';

const layout = layoutStack();
const node = (id: string) => layout.nodes.find((entry) => entry.id === id)!;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('stack layout', () => {
	it('places every service exactly once with the query router at the centre', () => {
		expect(layout.nodes.map((entry) => entry.id).sort()).toEqual(SERVICES.map((service) => service.id).sort());
		expect(node('query-router')).toMatchObject({ x: layout.centre.x, y: layout.centre.y });
	});

	it('keeps nodes apart and inside the view box', () => {
		for (const [index, a] of layout.nodes.entries()) {
			expect(a.x - a.r).toBeGreaterThan(0);
			expect(a.y - a.r).toBeGreaterThan(0);
			expect(a.x + a.r).toBeLessThan(layout.width);
			expect(a.y + a.r).toBeLessThan(layout.height);
			for (const b of layout.nodes.slice(index + 1)) {
				expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} / ${b.id}`).toBeGreaterThan(a.r + b.r + 8);
			}
		}
	});

	it('draws one curve per declared dependency', () => {
		const declared = SERVICES.reduce((sum, service) => sum + service.dependsOn.length, 0);
		expect(layout.edges).toHaveLength(declared);
		for (const edge of layout.edges) expect(edge.d).toMatch(/^M [\d.]+ [\d.]+ Q /);
	});

	it('has room for every service label at full size', () => {
		const services = layout.nodes.filter((entry) => !entry.job).map((entry) => entry.id);
		expect([...visibleLabels(layout, services, 11).keys()]).toEqual(services);
	});

	it('is deterministic', () => {
		expect(layoutStack()).toEqual(layout);
	});
});

describe('visible labels', () => {
	it('keeps the highest-priority label and never returns two that overlap', () => {
		for (const size of [11, 18, 26, 34]) {
			const order = ['query-router', ...layout.nodes.map((entry) => entry.id)];
			const shown = [...visibleLabels(layout, order, size).keys()];
			expect(shown[0]).toBe('query-router');
			const terminals = layout.terminals.flatMap((terminal) => terminalBoxes(terminal, size));
			for (const box of terminals) {
				expect(box.x).toBeGreaterThanOrEqual(0);
				expect(box.y).toBeGreaterThanOrEqual(0);
			}
			const boxes = [...terminals, ...shown.map((id) => labelBox(node(id), size))];
			boxes.slice(terminals.length).forEach((box, index) => {
				expect(box.x).toBeGreaterThanOrEqual(0);
				expect(box.x + box.w).toBeLessThanOrEqual(layout.width);
				for (const other of boxes.filter((_, at) => at !== index + terminals.length)) expect(overlaps(box, other)).toBe(false);
			});
		}
	});

	it('always labels the focused service when it fits on screen, even beside a dot', () => {
		const order = layout.nodes.map((entry) => entry.id);
		expect(visibleLabels(layout, order, 36).has('query-router')).toBe(false);
		expect([...visibleLabels(layout, order, 36, ['query-router']).keys()][0]).toBe('query-router');
	});

	it('flips a focused label inward when the outward side runs off screen', () => {
		const kong = node('kong');
		expect(labelBox(kong, 36).x).toBeLessThan(0);
		const shown = visibleLabels(layout, [], 36, ['kong']);
		expect(shown.get('kong')).toBe(true);
		expect(labelBox(kong, 36, true).x).toBeGreaterThan(kong.x);
	});

	it('drops labels as they grow, so a small screen shows fewer', () => {
		const order = layout.nodes.map((entry) => entry.id);
		expect(visibleLabels(layout, order, 34).size).toBeLessThan(visibleLabels(layout, order, 11).size);
	});
});

describe('spatial navigation', () => {
	it('moves to the nearest node in the pressed direction', () => {
		expect(nearestInDirection(layout.nodes, 'waf', 'ArrowUp')).toBe('kong');
		expect(nearestInDirection(layout.nodes, 'query-router', 'ArrowRight')).toBe('gdpr-service');
		expect(nearestInDirection(layout.nodes, 'query-router', 'ArrowDown')).toBe('analytics-service');
	});

	it('stays put when nothing lies that way', () => {
		const leftmost = [...layout.nodes].sort((a, b) => a.x - b.x)[0]!;
		expect(nearestInDirection(layout.nodes, leftmost.id, 'ArrowLeft')).toBe(leftmost.id);
	});
});

describe('route path', () => {
	it('starts at the first point and ends on the last', () => {
		const d = routePath([{ x: 10, y: 10 }, { x: 50, y: 20 }, { x: 90, y: 80 }], { x: 50, y: 50 });
		expect(d.startsWith('M 10 10')).toBe(true);
		expect(d.endsWith('90 80')).toBe(true);
		expect(d.match(/Q/g)).toHaveLength(2);
	});
});
