// The planet under the hero devices: a night-side globe whose surface is a
// dotted map (continents from lib/sky-sphere) turning slowly, city lights, red
// arcs hopping between cities like messages between apps, an atmosphere along
// its limb and the sun rising behind it. Drawn on the hero sky canvas by
// scripts/hero-universe.ts, between the stars and the item links.
// Caveat: dots are spaced by angle, so they bunch up toward the limb (as on a
// real globe); the limb dimming hides it. Only the cap above the canvas
// bottom is generated, so a canvas that grows taller than it was measured at
// shows bare planet until the next measure.

import { isLand, sphereProjector, spherePoint, type Vec3 } from '../lib/sky-sphere';
import { createRandom, curvePoint, easeInOut, withAlpha, type Point } from '../lib/universe-motion';

type Dot = Vec3 & { point: Vec3; city: boolean; seen: boolean };
type Arc = { from: Dot; to: Dot; start: number; duration: number };

export type Planet = {
	measure: (width: number, horizon: number, height: number) => void;
	draw: (ctx: CanvasRenderingContext2D, now: number, moving: boolean) => void;
};

// The pole is tipped away, so the visible cap is mid-latitudes drifting by.
const TILT = -0.5;
const SPIN_PER_MS = 0.000006;
const ARC_EVERY_MS = 700;
const MAX_ARCS = 5;
const ARRIVAL_MS = 600;
const SHADES = 5;

export function createPlanet(signal: string): Planet {
	const random = createRandom(23);
	let dots: Dot[] = [];
	let cities: Dot[] = [];
	let arcs: Arc[] = [];
	let lastArcAt = 0;
	let radius = 0;
	let centre: Point = { x: 0, y: 0 };
	let horizon = 0;
	let width = 0;
	let height = 0;
	const shades: Dot[][] = Array.from({ length: SHADES }, () => []);

	function measure(nextWidth: number, nextHorizon: number, nextHeight: number): void {
		width = nextWidth;
		horizon = nextHorizon;
		height = nextHeight;
		radius = Math.max(width * 1.4, 760);
		centre = { x: width / 2, y: horizon + radius };
		const step = (width < 640 ? 11 : 15) / radius;
		const reach = Math.acos(Math.max(-1, 1 - (height - horizon + 40) / radius));
		const lowest = Math.PI / 2 + TILT - reach;
		const scatter = createRandom(5);
		dots = [];
		for (let lat = Math.PI / 2 - step / 2; lat > lowest; lat -= step) {
			const ring = Math.max(1, Math.round((Math.PI * 2 * Math.cos(lat)) / step));
			const start = scatter() * Math.PI * 2;
			for (let index = 0; index < ring; index += 1) {
				const point = spherePoint(lat, start + (index / ring) * Math.PI * 2);
				if (isLand(point)) dots.push({ point, city: scatter() < 0.03, seen: false, x: 0, y: 0, z: 0 });
			}
		}
		arcs = [];
	}

	function drawGlobe(ctx: CanvasRenderingContext2D, breath: number): void {
		const sun = { x: width / 2, y: horizon + 6 };
		// The sun behind the limb: a wide glow spilling up into the sky.
		ctx.save();
		ctx.translate(sun.x, sun.y);
		ctx.scale(2.8, 1);
		const corona = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.min(width * 0.26, 320));
		corona.addColorStop(0, 'rgba(255,246,236,0.95)');
		corona.addColorStop(0.08, 'rgba(255,214,190,0.55)');
		corona.addColorStop(0.3, withAlpha(signal, 0.2));
		corona.addColorStop(1, withAlpha(signal, 0));
		ctx.globalAlpha = 0.78 + 0.22 * breath;
		ctx.fillStyle = corona;
		ctx.fillRect(-width, -460, width * 2, 900);
		ctx.restore();
		// Night side: a little lighter near the limb, where the atmosphere scatters.
		const body = ctx.createRadialGradient(centre.x, centre.y, radius - 260, centre.x, centre.y, radius);
		body.addColorStop(0, '#04060b');
		body.addColorStop(1, '#0f1626');
		ctx.globalAlpha = 1;
		ctx.fillStyle = body;
		ctx.beginPath();
		ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
		ctx.fill();
		// Atmosphere: a haze just outside the limb, cool near it, red further out.
		const air = ctx.createRadialGradient(centre.x, centre.y, radius - 24, centre.x, centre.y, radius + 90);
		air.addColorStop(0, 'rgba(120,160,255,0)');
		air.addColorStop(0.2, 'rgba(176,206,255,0.42)');
		air.addColorStop(0.34, withAlpha(signal, 0.14));
		air.addColorStop(1, withAlpha(signal, 0));
		ctx.fillStyle = air;
		ctx.fillRect(0, horizon - 100, width, Math.min(height - horizon + 100, 420));
		// The lit rim itself: brightest under the sun.
		const rim = ctx.createLinearGradient(0, 0, width, 0);
		rim.addColorStop(0, 'rgba(190,214,255,0.12)');
		rim.addColorStop(0.5, 'rgba(255,250,244,0.95)');
		rim.addColorStop(1, 'rgba(190,214,255,0.12)');
		ctx.strokeStyle = rim;
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		ctx.arc(centre.x, centre.y, radius, Math.PI, Math.PI * 2);
		ctx.stroke();
	}

	function placeDots(spin: number): void {
		const project = sphereProjector(spin, TILT, radius);
		for (const shade of shades) shade.length = 0;
		cities = [];
		for (const dot of dots) {
			project(dot.point, dot);
			dot.x += centre.x;
			dot.y += centre.y;
			dot.seen = dot.z > 0.02 && dot.x > -4 && dot.x < width + 4 && dot.y < height + 4;
			if (!dot.seen) continue;
			if (dot.city) cities.push(dot);
			else shades[Math.min(SHADES - 1, Math.floor(dot.z * 8))]!.push(dot);
		}
	}

	function drawDots(ctx: CanvasRenderingContext2D, now: number): void {
		ctx.fillStyle = '#c9d6f2';
		shades.forEach((shade, level) => {
			if (shade.length === 0) return;
			ctx.globalAlpha = 0.1 + level * 0.075;
			ctx.beginPath();
			const size = 0.9 + level * 0.18;
			for (const dot of shade) ctx.rect(dot.x - size / 2, dot.y - size / 2, size, size);
			ctx.fill();
		});
		ctx.fillStyle = '#ffe6c4';
		for (const city of cities) {
			ctx.globalAlpha = Math.min(1, 0.35 + city.z * 1.4) * (0.8 + 0.2 * Math.sin(now * 0.003 + city.point.x * 40));
			ctx.beginPath();
			ctx.arc(city.x, city.y, 1.1 + city.z * 1.6, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function spawnArc(now: number): void {
		if (now - lastArcAt < ARC_EVERY_MS || arcs.length >= MAX_ARCS || cities.length < 2) return;
		lastArcAt = now;
		const from = cities[Math.floor(random() * cities.length)]!;
		const near = cities.filter((city) => city !== from && Math.hypot(city.x - from.x, city.y - from.y) < width * 0.35);
		const to = near[Math.floor(random() * near.length)];
		if (to) arcs.push({ from, to, start: now, duration: 1500 + random() * 1300 });
	}

	function drawArcs(ctx: CanvasRenderingContext2D, now: number): void {
		arcs = arcs.filter((arc) => arc.from.seen && arc.to.seen && now - arc.start < arc.duration + ARRIVAL_MS);
		ctx.strokeStyle = signal;
		ctx.fillStyle = signal;
		for (const arc of arcs) {
			const chord = Math.hypot(arc.to.x - arc.from.x, arc.to.y - arc.from.y);
			const mid = { x: (arc.from.x + arc.to.x) / 2, y: (arc.from.y + arc.to.y) / 2 };
			const away = Math.hypot(mid.x - centre.x, mid.y - centre.y) || 1;
			const lift = chord * 0.45;
			const control = { x: mid.x + ((mid.x - centre.x) / away) * lift, y: mid.y + ((mid.y - centre.y) / away) * lift };
			const progress = (now - arc.start) / arc.duration;
			const travel = easeInOut(Math.min(1, progress));
			ctx.globalAlpha = 0.32 * Math.min(1, (now - arc.start) / 250) * (progress > 1 ? 1 - (progress - 1) * (arc.duration / ARRIVAL_MS) : 1);
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(arc.from.x, arc.from.y);
			for (let t = 0.1; t <= travel + 0.001; t += 0.1) {
				const point = curvePoint(arc.from, control, arc.to, Math.min(t, travel));
				ctx.lineTo(point.x, point.y);
			}
			ctx.stroke();
			if (progress < 1) {
				const head = curvePoint(arc.from, control, arc.to, travel);
				ctx.globalAlpha = 1;
				ctx.beginPath();
				ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2);
				ctx.fill();
			} else {
				const ring = (now - arc.start - arc.duration) / ARRIVAL_MS;
				ctx.globalAlpha = 0.8 * (1 - ring);
				ctx.lineWidth = 1.2;
				ctx.beginPath();
				ctx.arc(arc.to.x, arc.to.y, 2 + ring * 12, 0, Math.PI * 2);
				ctx.stroke();
			}
		}
	}

	function draw(ctx: CanvasRenderingContext2D, now: number, moving: boolean): void {
		if (radius === 0) return;
		const time = moving ? now : 0;
		drawGlobe(ctx, moving ? 0.5 + 0.5 * Math.sin(now * 0.0007) : 0.6);
		placeDots(time * SPIN_PER_MS);
		drawDots(ctx, time);
		if (moving) {
			spawnArc(now);
			drawArcs(ctx, now);
		}
		ctx.globalAlpha = 1;
	}

	return { measure, draw };
}
