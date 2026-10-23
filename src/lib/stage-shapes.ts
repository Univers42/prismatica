// Geometry for the page stage (lib/stage-scenes.ts): each generator returns a
// shape as points plus the edges between them, by local index, so scenes can
// be assembled from several shapes with `mergeShapes`.

import type { Point } from './universe-motion';

export type Edge = [number, number];

export interface Shape {
	points: Point[];
	edges: Edge[];
	accents: number[];
}

const empty = (): Shape => ({ points: [], edges: [], accents: [] });

/** `count` points evenly round a circle, each joined to the next. */
export function ring(centre: Point, radius: number, count: number, startAngle = -Math.PI / 2): Shape {
	const points = Array.from({ length: count }, (_, index) => {
		const angle = startAngle + (index / count) * Math.PI * 2;
		return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius };
	});
	const edges: Edge[] = points.map((_, index) => [index, (index + 1) % count]);
	return { points, edges: count > 1 ? edges : [], accents: [] };
}

/**
 * Seven flat-topped hexagons — a centre cell and its six neighbours — with
 * shared corners merged, plus each cell's centre as an accent.
 */
export function honeycomb(centre: Point, cellRadius: number): Shape {
	const shape = empty();
	const keyed = new Map<string, number>();
	const corner = (point: Point): number => {
		const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
		const known = keyed.get(key);
		if (known !== undefined) return known;
		shape.points.push(point);
		keyed.set(key, shape.points.length - 1);
		return shape.points.length - 1;
	};
	const step = cellRadius * Math.sqrt(3);
	const cells = [centre, ...Array.from({ length: 6 }, (_, index) => {
		const angle = Math.PI / 6 + (index * Math.PI) / 3;
		return { x: centre.x + Math.cos(angle) * step, y: centre.y + Math.sin(angle) * step };
	})];
	const seen = new Set<string>();
	for (const cell of cells) {
		const corners = Array.from({ length: 6 }, (_, index) => corner({
			x: cell.x + Math.cos((index * Math.PI) / 3) * cellRadius,
			y: cell.y + Math.sin((index * Math.PI) / 3) * cellRadius,
		}));
		corners.forEach((from, index) => {
			const to = corners[(index + 1) % 6]!;
			const key = from < to ? `${from}-${to}` : `${to}-${from}`;
			if (!seen.has(key)) shape.edges.push([from, to]);
			seen.add(key);
		});
	}
	for (const cell of cells) {
		shape.points.push(cell);
		shape.accents.push(shape.points.length - 1);
	}
	return shape;
}

/** The outline of a rectangle, `perSide` points on each side, corners included once. */
export function rectangle(origin: Point, width: number, height: number, perSide: number): Shape {
	const corners = [origin, { x: origin.x + width, y: origin.y }, { x: origin.x + width, y: origin.y + height }, { x: origin.x, y: origin.y + height }];
	const points: Point[] = [];
	corners.forEach((from, side) => {
		const to = corners[(side + 1) % 4]!;
		for (let step = 0; step < perSide; step += 1) {
			const t = step / perSide;
			points.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
		}
	});
	const edges: Edge[] = points.map((_, index) => [index, (index + 1) % points.length]);
	return { points, edges, accents: [1, 2] };
}

/** Rows of points joined left to right, like lines of code; each row may be indented. */
export function rows(origin: Point, lengths: number[], indents: number[], step: number, gap: number): Shape {
	const shape = empty();
	lengths.forEach((length, row) => {
		const first = shape.points.length;
		for (let column = 0; column < length; column += 1) {
			shape.points.push({ x: origin.x + ((indents[row] ?? 0) + column) * step, y: origin.y + row * gap });
			if (column > 0) shape.edges.push([shape.points.length - 2, shape.points.length - 1]);
		}
		shape.accents.push(first);
	});
	return shape;
}

/** Vertical chains rising from a common baseline; the top of each is an accent. */
export function columns(base: Point, heights: number[], step: number, gap: number): Shape {
	const shape = empty();
	heights.forEach((height, column) => {
		for (let level = 0; level < height; level += 1) {
			shape.points.push({ x: base.x + column * gap, y: base.y - level * step });
			if (level > 0) shape.edges.push([shape.points.length - 2, shape.points.length - 1]);
		}
		shape.accents.push(shape.points.length - 1);
	});
	return shape;
}

/** Concatenates shapes, shifting each one's edge and accent indices past the previous points. */
export function mergeShapes(...shapes: Shape[]): Shape {
	const merged = empty();
	for (const shape of shapes) {
		const offset = merged.points.length;
		merged.points.push(...shape.points);
		merged.edges.push(...shape.edges.map(([a, b]): Edge => [a + offset, b + offset]));
		merged.accents.push(...shape.accents.map((index) => index + offset));
	}
	return merged;
}
