// The hero's star field: three depth layers of stars in real colour
// temperatures, a faint nebula band, bright stars that flare, and an
// occasional meteor. `parallax` shifts each layer by its depth (scroll and
// pointer), so near stars slide past far ones. Drawn on the hero sky canvas by
// scripts/hero-universe.ts, before the planet, which hides the ones below it.
// Caveat: twinkle is a sine per star, not real scintillation. A layer shifted
// past an edge wraps to the opposite one, so parallax never leaves an empty
// strip, but a star near the edge can be seen jumping across.

import { createRandom, withAlpha, type Point } from '../lib/universe-motion';

type Star = Point & { size: number; alpha: number; speed: number; phase: number; color: string; layer: number };
type Meteor = { start: number; from: Point; angle: number; length: number };

export type StarField = {
	measure: (width: number, height: number) => void;
	draw: (ctx: CanvasRenderingContext2D, now: number, moving: boolean, parallax: { scroll: number; pointer: Point }) => void;
};

// Per layer (far, mid, near): share of stars, size range, and how far scroll
// and pointer move it. Far stars are pushed back against the scroll most, so
// they drift past slowest.
const LAYERS = [
	{ share: 0.74, size: [0.5, 0.9], alpha: [0.22, 0.6], scroll: 0.42, pointer: 4 },
	{ share: 0.22, size: [0.8, 1.35], alpha: [0.45, 0.85], scroll: 0.26, pointer: 9 },
	{ share: 0.04, size: [1.3, 2.1], alpha: [0.8, 1], scroll: 0.1, pointer: 16 },
] as const;
// Blue-white to warm: the spread of colours visible to the naked eye.
const COLOURS = ['#ffffff', '#ffffff', '#e4ecff', '#cddbff', '#fff3df', '#ffe0c8'];

const wrap = (value: number, size: number): number => ((value % size) + size) % size;

export function createStarField(): StarField {
	const random = createRandom(9);
	let stars: Star[] = [];
	let nebula: (Point & { radius: number; colour: string })[] = [];
	let meteor: Meteor | null = null;
	let nextMeteorAt = 3500;
	let width = 0;
	let height = 0;

	function measure(nextWidth: number, nextHeight: number): void {
		width = nextWidth;
		height = nextHeight;
		const seeded = createRandom(1999);
		const pick = (range: readonly [number, number]): number => range[0] + seeded() * (range[1] - range[0]);
		stars = Array.from({ length: Math.round((width * height) / 2300) }, () => {
			const roll = seeded();
			const layer = roll < LAYERS[0].share ? 0 : roll < LAYERS[0].share + LAYERS[1].share ? 1 : 2;
			const spec = LAYERS[layer]!;
			return {
				x: seeded() * width, y: seeded() * height, layer,
				size: pick(spec.size), alpha: pick(spec.alpha),
				speed: 0.0008 + seeded() * 0.0024, phase: seeded() * Math.PI * 2,
				color: COLOURS[Math.floor(seeded() * COLOURS.length)]!,
			};
		}).sort((a, b) => a.color.localeCompare(b.color));
		// A diagonal band of faint glow, like the Milky Way seen edge-on.
		nebula = Array.from({ length: 7 }, (_, index) => {
			const t = index / 6;
			return {
				x: width * (0.05 + t * 0.9) + (seeded() - 0.5) * width * 0.12,
				y: height * (0.06 + t * 0.32) + (seeded() - 0.5) * 80,
				radius: Math.max(width, 600) * (0.12 + seeded() * 0.1),
				colour: index % 3 === 0 ? '#8a3a6a' : index % 3 === 1 ? '#34508f' : '#5a4f9a',
			};
		});
	}

	function drawNebula(ctx: CanvasRenderingContext2D, shift: number): void {
		for (const cloud of nebula) {
			const y = cloud.y + shift;
			const glow = ctx.createRadialGradient(cloud.x, y, 0, cloud.x, y, cloud.radius);
			glow.addColorStop(0, withAlpha(cloud.colour, 0.08));
			glow.addColorStop(1, withAlpha(cloud.colour, 0));
			ctx.fillStyle = glow;
			ctx.fillRect(cloud.x - cloud.radius, y - cloud.radius, cloud.radius * 2, cloud.radius * 2);
		}
	}

	function drawStars(ctx: CanvasRenderingContext2D, now: number, moving: boolean, scroll: number, pointer: Point): void {
		let colour = '';
		for (const star of stars) {
			const spec = LAYERS[star.layer]!;
			const x = wrap(star.x + pointer.x * spec.pointer, width);
			const y = wrap(star.y + scroll * spec.scroll + pointer.y * spec.pointer, height);
			const twinkle = 0.7 + 0.3 * Math.sin((moving ? now * star.speed : 0) + star.phase);
			if (star.color !== colour) {
				colour = star.color;
				ctx.fillStyle = colour;
				ctx.strokeStyle = colour;
			}
			ctx.globalAlpha = star.alpha * twinkle;
			if (star.layer < 2) {
				ctx.fillRect(x - star.size / 2, y - star.size / 2, star.size, star.size);
				continue;
			}
			ctx.beginPath();
			ctx.arc(x, y, star.size, 0, Math.PI * 2);
			ctx.fill();
			// Bright stars flare into a cross at their peak.
			const flare = Math.max(0, twinkle - 0.88) / 0.12;
			if (flare <= Number.EPSILON) continue;
			const reach = star.size * (4 + flare * 6);
			ctx.globalAlpha = 0.55 * flare;
			ctx.lineWidth = 0.6;
			ctx.beginPath();
			ctx.moveTo(x - reach, y);
			ctx.lineTo(x + reach, y);
			ctx.moveTo(x, y - reach);
			ctx.lineTo(x, y + reach);
			ctx.stroke();
		}
	}

	function drawMeteor(ctx: CanvasRenderingContext2D, now: number): void {
		if (!meteor && now > nextMeteorAt) {
			meteor = { start: now, from: { x: random() * width * 0.7, y: random() * height * 0.3 }, angle: 0.3 + random() * 0.35, length: 120 + random() * 90 };
		}
		if (!meteor) return;
		const age = (now - meteor.start) / 1000;
		if (age >= 1) {
			meteor = null;
			nextMeteorAt = now + 5000 + random() * 7000;
			return;
		}
		const distance = age * 560;
		const head = { x: meteor.from.x + Math.cos(meteor.angle) * distance, y: meteor.from.y + Math.sin(meteor.angle) * distance };
		const tail = { x: head.x - Math.cos(meteor.angle) * meteor.length, y: head.y - Math.sin(meteor.angle) * meteor.length };
		const trail = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
		trail.addColorStop(0, 'rgba(255,255,255,0)');
		trail.addColorStop(1, 'rgba(255,255,255,0.9)');
		ctx.globalAlpha = Math.sin(age * Math.PI);
		ctx.strokeStyle = trail;
		ctx.lineWidth = 1.5;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(tail.x, tail.y);
		ctx.lineTo(head.x, head.y);
		ctx.stroke();
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(head.x, head.y, 1.6, 0, Math.PI * 2);
		ctx.fill();
	}

	function draw(ctx: CanvasRenderingContext2D, now: number, moving: boolean, parallax: { scroll: number; pointer: Point }): void {
		ctx.globalAlpha = 1;
		drawNebula(ctx, parallax.scroll * LAYERS[0].scroll);
		drawStars(ctx, now, moving, parallax.scroll, parallax.pointer);
		if (moving) drawMeteor(ctx, now);
		ctx.globalAlpha = 1;
	}

	return { measure, draw };
}
