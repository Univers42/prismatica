/* ************************************************************************** */
/*                                                                            */
/*                                                 :::      ::::::::   */
/*   mascot.ts                                        :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { clamp, randomIndex, randomBetween } from '../lib/math';
import { bindScrollLean } from '../lib/scroll-lean';
import { queryElement, isButton, isHtmlElement, setTrustedInnerHTML } from '../lib/dom-utils';
import { notify, type NotificationKind, type NotificationOptions } from './notifications';

export type MascotMood = 'curious' | 'close' | 'gentle' | 'happy' | 'excited' | 'listening' | 'sleeping' | 'bye' | 'thinking' | 'shy' | 'proud' | 'seller' | 'laughing' | 'dizzy' | 'angry' | 'silly' | 'surprised' | 'love' | 'scared';

export type MascotState = {
	targetX: number;
	targetY: number;
	targetHeadX: number;
	targetHeadY: number;
	depthX: number;
	depthY: number;
	eyeX: number;
	eyeY: number;
	headX: number;
	headY: number;
	lastPointerAngle: number | undefined;
	orbitTravel: number;
	lastBrowLift: number;
	lastMove: number;
	lockedUntil: number;
	idleMoodShown: boolean;
	moodTimer: ReturnType<typeof setTimeout> | undefined;
	heartTimer: ReturnType<typeof setInterval> | undefined;
	zTimer: ReturnType<typeof setInterval> | undefined;
	laughTimer: ReturnType<typeof setInterval> | undefined;
	frame: number | undefined;
};

const mascotState: MascotState = {
	targetX: 0,
	targetY: 0,
	targetHeadX: 0,
	targetHeadY: 0,
	depthX: 5,
	depthY: 4,
	eyeX: 0,
	eyeY: 0,
	headX: 0,
	headY: 0,
	lastPointerAngle: undefined,
	orbitTravel: 0,
	lastBrowLift: 0,
	lastMove: Date.now(),
	lockedUntil: 0,
	idleMoodShown: false,
	moodTimer: undefined,
	heartTimer: undefined,
	zTimer: undefined,
	laughTimer: undefined,
	frame: undefined,
};

// Decorative: the button around it carries the name, and a titled SVG inside
// a labelled button gives it text its label does not contain (WCAG 2.5.3).
function mascotSvgMarkup(): string {
	return `
		<svg class="binocle__svg" viewBox="0 0 184 118" aria-hidden="true">
			<defs>
				<radialGradient id="binocle-glass" cx="0.35" cy="0.3" r="0.9">
					<stop offset="0" class="svg-glass-core" />
					<stop offset="1" class="svg-glass-edge" />
				</radialGradient>
				<clipPath id="binocle-glass-clip">
					<circle cx="46" cy="58" r="25" />
					<circle cx="138" cy="58" r="25" />
				</clipPath>
			</defs>
			<g class="svg-body-group">
				<path class="svg-arm left" d="M42 24 C30 14, 16 16, 10 30" />
				<path class="svg-arm right" d="M142 24 C154 14, 168 15, 174 30" />
				<circle class="svg-shell left" cx="46" cy="58" r="38" />
				<circle class="svg-shell right" cx="138" cy="58" r="38" />
				<circle class="svg-frame left-frame" cx="46" cy="58" r="30" />
				<circle class="svg-frame right-frame" cx="138" cy="58" r="30" />
				<circle class="svg-glass left" cx="46" cy="58" r="25" />
				<circle class="svg-glass right" cx="138" cy="58" r="25" />
				<rect class="svg-cap left" x="33" y="12" width="26" height="10" rx="4" />
				<rect class="svg-cap right" x="125" y="12" width="26" height="10" rx="4" />
				<rect class="svg-bridge" x="82" y="50" width="20" height="16" rx="6" />
				<circle class="svg-hinge" cx="92" cy="47" r="4" />
				<g class="svg-glint" clip-path="url(#binocle-glass-clip)">
					<path class="svg-glint-line" d="M40 46 L52 58" />
					<path class="svg-glint-line" d="M132 46 L144 58" />
				</g>
				<path class="svg-brow left" d="M33 9 C38 4, 54 4, 59 9" />
				<path class="svg-brow right" d="M125 9 C130 4, 146 4, 151 9" />
				<ellipse class="svg-cheek left" cx="22" cy="68" rx="9" ry="6" />
				<ellipse class="svg-cheek right" cx="162" cy="68" rx="9" ry="6" />
				<path class="svg-sweat" d="M166 30 C172 39, 171 47, 165 50 C159 45, 159 37, 166 30Z" />
				<path class="svg-tear" d="M158 68 C165 78, 164 86, 157 89 C150 84, 151 76, 158 68Z" />
				<g class="svg-stars"><path class="svg-star" d="M23 13 L26 20 L33 21 L28 26 L29 33 L23 29 L17 33 L18 26 L13 21 L20 20Z" /><path class="svg-star" d="M159 10 L162 17 L169 18 L164 23 L165 30 L159 26 L153 30 L154 23 L149 18 L156 17Z" /><path class="svg-star" d="M94 5 L96 11 L102 12 L98 16 L99 22 L94 19 L89 22 L90 16 L86 12 L92 11Z" /></g>
				<path class="svg-spiral left" d="M46 49 C55 49, 56 61, 46 62 C39 62, 39 55, 45 55" />
				<path class="svg-spiral right" d="M138 49 C147 49, 148 61, 138 62 C131 62, 131 55, 137 55" />
				<g class="svg-eye left"><circle class="svg-pupil" cx="46" cy="58" r="11" /><circle class="svg-pupil-shine" cx="41.8" cy="53.8" r="3" /></g>
				<g class="svg-eye right"><circle class="svg-pupil" cx="138" cy="58" r="11" /><circle class="svg-pupil-shine" cx="133.8" cy="53.8" r="3" /></g>
				<path class="svg-pupil-heart left" d="M46 53 C46 47, 38 44, 35 50 C32 56, 46 65, 46 65 C46 65, 60 56, 57 49 C54 42, 46 45, 46 51Z" />
				<path class="svg-pupil-heart right" d="M138 53 C138 47, 130 44, 127 50 C124 56, 138 65, 138 65 C138 65, 152 56, 149 49 C146 42, 138 45, 138 51Z" />
				<g class="svg-thought-bubble"><circle cx="14" cy="30" r="2.5" /><circle cx="9" cy="22" r="4" /><circle cx="5" cy="13" r="6" /></g>
				<circle class="svg-lid left" cx="46" cy="58" r="25" />
				<circle class="svg-lid right" cx="138" cy="58" r="25" />
				<rect class="svg-mouth-pad" x="64" y="82" width="56" height="30" rx="14" />
				<path class="svg-mouth smile" d="M83 94 C87 100, 97 100, 101 94" />
				<path class="svg-mouth ajar" d="M85 93 C88 99, 96 99, 99 93 C95 96, 89 96, 85 93Z" />
				<path class="svg-mouth open" d="M84 95 C84 89, 87 86, 92 86 C97 86, 100 89, 100 95 C100 101, 97 104, 92 104 C87 104, 84 101, 84 95Z" />
				<path class="svg-mouth-core" d="M88 94 C88 91, 90 89, 92 89 C94 89, 96 91, 96 94 C96 97, 94 98, 92 98 C90 98, 88 97, 88 94Z" />
				<ellipse class="svg-mouth-shine" cx="89" cy="91" rx="2.5" ry="1.8" />
				<path class="svg-mouth flat" d="M84 96 C88 97.5, 96 97.5, 100 96" />
				<path class="svg-mouth grimace" d="M85 92 L99 92 L98 100 C94 102, 90 102, 86 100 Z" />
				<path class="svg-mouth teeth" d="M85 94 L99 94 M88 94 L88 99 M92 94 L92 99 M96 94 L96 99" />
				<ellipse class="svg-mouth ooh" cx="92" cy="95" rx="4.5" ry="5.5" />
				<path class="svg-mouth tremble" d="M84 96 C87 92, 89 100, 92 96 C95 92, 97 100, 100 95" />
				<path class="svg-mouth smirk" d="M84 97 C88 101, 98 102, 101 94" />
				<path class="svg-mouth silly-open" d="M84 95 C84 89, 87 86, 92 86 C97 86, 100 89, 100 95 Z" />
				<ellipse class="svg-mouth silly-tongue" cx="92" cy="99" rx="6" ry="4.5" />
				<path class="svg-mouth zip" d="M84 96 L100 96 M88 93 L92 99 M96 93 L100 99" />
				<path class="svg-spark" d="M160 92 L166 85 M162 100 L171 101 M155 99 L149 104" />
			</g>
		</svg>`;
}

function prepareMascotSvg(mascot: HTMLButtonElement): void {
	const svg = mascot.querySelector('.binocle__svg');
	if (!(svg instanceof SVGSVGElement)) {
		return;
	}
	svg.setAttribute('focusable', 'false');
}

function mascotMotionPaused(): boolean {
	return document.documentElement.classList.contains('motion-paused');
}

function stopMascotEffects(mascot: HTMLButtonElement): void {
	globalThis.clearInterval(mascotState.heartTimer);
	globalThis.clearInterval(mascotState.zTimer);
	globalThis.clearInterval(mascotState.laughTimer);
	mascotState.heartTimer = undefined;
	mascotState.zTimer = undefined;
	mascotState.laughTimer = undefined;
	mascot.querySelectorAll('.binocle__heart, .binocle__z, .binocle__laugh, .binocle__laugh-tear, .binocle__ping').forEach((particle) => particle.remove());
}

function createHeart(mascot: HTMLButtonElement): void {
	const heart = document.createElement('span');
	heart.className = 'binocle__heart';
	heart.textContent = ['♥', '♡', '✦'][randomIndex(3)] ?? '♥';
	heart.style.left = `${randomBetween(34, 34)}%`;
	heart.style.setProperty('--heart-x', `${randomBetween(-28, 56)}px`);
	mascot.append(heart);
	heart.addEventListener('animationend', () => heart.remove(), { once: true });
}

function createSleepZ(mascot: HTMLButtonElement): void {
	const zed = document.createElement('span');
	zed.className = 'binocle__z';
	zed.textContent = 'Z';
	zed.style.left = `${randomBetween(54, 24)}%`;
	zed.style.setProperty('--z-x', `${randomBetween(-14, 42)}px`);
	mascot.append(zed);
	zed.addEventListener('animationend', () => zed.remove(), { once: true });
}

function createLaughParticle(mascot: HTMLButtonElement): void {
	const laugh = document.createElement('span');
	laugh.className = 'binocle__laugh-tear';
	laugh.style.left = `${randomBetween(30, 44)}%`;
	laugh.style.top = `${randomBetween(18, 32)}%`;
	laugh.style.setProperty('--laugh-x', `${randomBetween(-30, 60)}px`);
	laugh.style.setProperty('--laugh-rot', `${randomBetween(-17, 34)}deg`);
	mascot.append(laugh);
	laugh.addEventListener('animationend', () => laugh.remove(), { once: true });
}

function createPing(mascot: HTMLButtonElement): void {
	const ping = document.createElement('span');
	ping.className = 'binocle__ping';
	ping.style.left = `${randomBetween(48, 32)}%`;
	ping.style.top = `${randomBetween(30, 30)}%`;
	mascot.append(ping);
	ping.addEventListener('animationend', () => ping.remove(), { once: true });
}

function startMascotStars(mascot: HTMLButtonElement): void {
	if (mascotMotionPaused()) {
		return;
	}
	mascot.classList.remove('is-star-pop');
	mascot.getBoundingClientRect();
	mascot.classList.add('is-star-pop');
	globalThis.setTimeout(() => mascot.classList.remove('is-star-pop'), 1100);
	mascot.querySelectorAll('.svg-star').forEach((star, index) => {
		star.animate([
			{ opacity: 0, transform: 'translateY(4px) scale(0.25) rotate(-20deg)' },
			{ opacity: 1, transform: 'translateY(-7px) scale(1.35) rotate(12deg)' },
			{ opacity: 1, transform: 'translateY(0) scale(1) rotate(0deg)' },
		], { duration: 560, delay: index * 75, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
	});
}

function liftMascotBrows(mascot: HTMLButtonElement, duration = 680): void {
	mascot.classList.remove('is-brow-pop');
	mascot.getBoundingClientRect();
	mascot.classList.add('is-brow-pop');
	globalThis.setTimeout(() => mascot.classList.remove('is-brow-pop'), duration);
}

function startMascotMoodEffect(mascot: HTMLButtonElement, mood: MascotMood): void {
	if (mascotMotionPaused()) {
		return;
	}
	if (mood === 'love') {
		createHeart(mascot);
		mascotState.heartTimer = globalThis.setInterval(() => createHeart(mascot), 380);
	}
	if (mood === 'excited' || mood === 'happy') {
		startMascotStars(mascot);
	}
	if (mood === 'sleeping') {
		createSleepZ(mascot);
		mascotState.zTimer = globalThis.setInterval(() => createSleepZ(mascot), 720);
	}
	if (mood === 'laughing') {
		createLaughParticle(mascot);
		createLaughParticle(mascot);
		mascotState.laughTimer = globalThis.setInterval(() => createLaughParticle(mascot), 170);
	}
	if (mood === 'surprised' || mood === 'seller') {
		createPing(mascot);
	}
}

function wakeMascotPose(mascot: HTMLButtonElement): void {
	mascot.style.setProperty('--blink', '1');
	mascot.style.setProperty('--tilt', '0deg');
	mascotState.targetHeadX = 0;
	mascotState.targetHeadY = 0;
	mascotState.headX *= 0.35;
	mascotState.headY *= 0.35;
}

function sleepMascotPose(mascot: HTMLButtonElement): void {
	mascot.style.setProperty('--blink', '0.08');
	mascot.style.setProperty('--tilt', '9deg');
	mascotState.targetX = 0;
	mascotState.targetY = 0;
	mascotState.eyeX = 0;
	mascotState.eyeY = 0;
	mascotState.targetHeadX = -7;
	mascotState.targetHeadY = 13;
	mascotState.headX = -7;
	mascotState.headY = 13;
	mascotState.depthX = 7;
	mascotState.depthY = 2;
}

function setMascotMood(mascot: HTMLButtonElement, mood: MascotMood, duration = 0, locked = false): void {
	if (mascot.dataset.mood === mood && duration === 0 && !locked) {
		return;
	}
	const previousMood = mascot.dataset.mood;
	globalThis.clearTimeout(mascotState.moodTimer);
	stopMascotEffects(mascot);
	mascot.dataset.mood = mood;
	if (previousMood === 'sleeping' && mood !== 'sleeping') {
		wakeMascotPose(mascot);
	}
	if (mood === 'sleeping') {
		sleepMascotPose(mascot);
	}
	startMascotMoodEffect(mascot, mood);
	if (mood === 'seller') {
		liftMascotBrows(mascot, 520);
	}
	if (locked) {
		mascotState.lockedUntil = Date.now() + duration;
	}
	if (duration > 0) {
		mascotState.moodTimer = globalThis.setTimeout(() => setMascotMood(mascot, 'curious'), duration);
	}
}

function updateMascotOrbit(mascot: HTMLButtonElement, angle: number, distance: number): void {
	if (mascotState.lastPointerAngle === undefined || distance <= 68 || distance >= 360) {
		mascotState.orbitTravel *= 0.82;
		mascotState.lastPointerAngle = angle;
		return;
	}
	let delta = angle - mascotState.lastPointerAngle;
	if (delta > Math.PI) {
		delta -= Math.PI * 2;
	} else if (delta < -Math.PI) {
		delta += Math.PI * 2;
	}
	mascotState.orbitTravel = Math.min(Math.PI * 3, mascotState.orbitTravel * 0.92 + Math.abs(delta));
	if (mascotState.orbitTravel > Math.PI * 1.35 && Date.now() - mascotState.lastBrowLift > 680 && Date.now() > mascotState.lockedUntil) {
		setMascotMood(mascot, 'curious', 760, true);
		liftMascotBrows(mascot, 760);
		mascotState.lastBrowLift = Date.now();
		mascotState.orbitTravel = 0;
	}
	mascotState.lastPointerAngle = angle;
}

function updateMascotPoseFromPointer(mascot: HTMLButtonElement, dx: number, dy: number, closeness: number): void {
	mascotState.targetX = clamp(dx / 36, -7, 7);
	mascotState.targetY = clamp(dy / 42, -4.8, 4.8);
	mascotState.targetHeadX = clamp(dx / 84, -6, 6);
	mascotState.targetHeadY = clamp(-dy / 86, -6, 6);
	mascotState.lastMove = Date.now();
	mascotState.idleMoodShown = false;
	mascot.style.setProperty('--tilt', `${clamp(dx / 140, -3, 3).toFixed(2)}deg`);
	mascot.style.setProperty('--body-roll', `${clamp(dx / 190, -2.2, 2.2).toFixed(2)}deg`);
	mascot.style.setProperty('--body-x', `${clamp(dx / 120, -3.5, 3.5).toFixed(2)}px`);
	mascot.style.setProperty('--body-y', `${clamp(dy / 135, -2.5, 3.5).toFixed(2)}px`);
	mascotState.depthX = 5 - clamp(dx / 85, -4, 4);
	mascotState.depthY = 4 - clamp(dy / 95, -3, 4);
	mascot.style.setProperty('--depth-z', `${(closeness * 16).toFixed(2)}px`);
}

function updateMascotTarget(mascot: HTMLButtonElement, pointerX: number, pointerY: number): void {
	if (document.body.classList.contains('portal-open')) {
		return;
	}
	const wasSleeping = mascot.dataset.mood === 'sleeping';
	const rect = mascot.getBoundingClientRect();
	const centerX = rect.left + rect.width / 2;
	const centerY = rect.top + rect.height / 2;
	const dx = pointerX - centerX;
	const dy = pointerY - centerY;
	const distance = Math.hypot(dx, dy);
	const closeness = clamp(1 - distance / 520, 0, 1);
	const angle = Math.atan2(dy, dx);
	updateMascotOrbit(mascot, angle, distance);
	updateMascotPoseFromPointer(mascot, dx, dy, closeness);
	if (wasSleeping && Date.now() > mascotState.lockedUntil) {
		setMascotMood(mascot, distance < 180 ? 'gentle' : 'curious', 520, true);
		return;
	}
	if (Date.now() < mascotState.lockedUntil) {
		return;
	}
	if (distance < 92) {
		setMascotMood(mascot, 'close');
	} else if (distance < 170) {
		setMascotMood(mascot, 'gentle');
	} else if (distance < 280) {
		setMascotMood(mascot, 'happy');
	} else if (mascot.dataset.mood !== 'bye') {
		setMascotMood(mascot, 'curious');
	}
}

function animateMascot(mascot: HTMLButtonElement): void {
	const mood = mascot.dataset.mood;
	const sleeping = mood === 'sleeping';
	if (mood === 'thinking') {
		mascotState.targetX += (-4.4 - mascotState.targetX) * 0.02;
		mascotState.targetY += (-2.8 - mascotState.targetY) * 0.02;
		mascotState.targetHeadX += (-2.2 - mascotState.targetHeadX) * 0.018;
		mascotState.targetHeadY += (1.1 - mascotState.targetHeadY) * 0.018;
	} else if (mood === 'shy') {
		mascotState.targetX += (3.8 - mascotState.targetX) * 0.045;
		mascotState.targetY += (3.1 - mascotState.targetY) * 0.045;
		mascotState.targetHeadX += (1.6 - mascotState.targetHeadX) * 0.03;
		mascotState.targetHeadY += (-0.8 - mascotState.targetHeadY) * 0.03;
	} else if (sleeping) {
		mascotState.targetX += (0 - mascotState.targetX) * 0.08;
		mascotState.targetY += (0 - mascotState.targetY) * 0.08;
		mascotState.targetHeadX += (-7 - mascotState.targetHeadX) * 0.06;
		mascotState.targetHeadY += (13 - mascotState.targetHeadY) * 0.06;
		mascotState.depthX += (7 - mascotState.depthX) * 0.04;
		mascotState.depthY += (2 - mascotState.depthY) * 0.04;
	}
	const speed = sleeping ? 0.09 : 0.16;
	const headSpeed = sleeping ? 0.055 : 0.11;
	mascotState.eyeX += (mascotState.targetX - mascotState.eyeX) * speed;
	mascotState.eyeY += (mascotState.targetY - mascotState.eyeY) * speed;
	mascotState.headX += (mascotState.targetHeadX - mascotState.headX) * headSpeed;
	mascotState.headY += (mascotState.targetHeadY - mascotState.headY) * headSpeed;
	mascot.style.setProperty('--look-x', `${mascotState.eyeX.toFixed(1)}px`);
	mascot.style.setProperty('--look-y', `${mascotState.eyeY.toFixed(1)}px`);
	mascot.style.setProperty('--lean-x', `${mascotState.headX.toFixed(1)}deg`);
	mascot.style.setProperty('--lean-y', `${mascotState.headY.toFixed(1)}deg`);
	mascot.style.setProperty('--parallax-x', `${(mascotState.headX * 0.16).toFixed(1)}px`);
	mascot.style.setProperty('--parallax-y', `${(mascotState.headY * -0.12).toFixed(1)}px`);
	mascot.style.setProperty('--depth-x', `${mascotState.depthX.toFixed(1)}px`);
	mascot.style.setProperty('--depth-y', `${mascotState.depthY.toFixed(1)}px`);
	const idle = Date.now() - mascotState.lastMove;
	if (idle > 3600 && !sleeping && !document.body.classList.contains('portal-open')) {
		mascotState.targetX = Math.sin(Date.now() / 1200) * 2.2;
		mascotState.targetY = Math.cos(Date.now() / 1450) * 1.4;
		mascotState.targetHeadX = Math.sin(Date.now() / 1800) * 0.9;
		mascotState.targetHeadY = Math.cos(Date.now() / 2100) * 0.55;
		mascot.style.setProperty('--tilt', '0deg');
		mascot.style.setProperty('--body-roll', '0deg');
		mascot.style.setProperty('--body-x', '0px');
		mascot.style.setProperty('--body-y', '0px');
		mascotState.depthX += (5 - mascotState.depthX) * 0.08;
		mascotState.depthY += (4 - mascotState.depthY) * 0.08;
		mascot.style.setProperty('--depth-z', '0px');
	}
	if (idle > 75000 && !sleeping && Date.now() > mascotState.lockedUntil) {
		setMascotMood(mascot, 'sleeping');
	} else if (idle > 14000 && !mascotState.idleMoodShown && Date.now() > mascotState.lockedUntil) {
		mascotState.idleMoodShown = true;
		const idleMoods: MascotMood[] = ['thinking', 'shy', 'proud'];
		setMascotMood(mascot, idleMoods[randomIndex(idleMoods.length)] ?? 'thinking', 2200, true);
		liftMascotBrows(mascot);
	}
	mascotState.frame = requestAnimationFrame(() => animateMascot(mascot));
}

function startMascotBlink(mascot: HTMLButtonElement): void {
	const blink = (): void => {
		const sleeping = mascot.dataset.mood === 'sleeping';
		mascot.style.setProperty('--blink', '0.08');
		if (!sleeping) {
			globalThis.setTimeout(() => mascot.style.setProperty('--blink', '1'), 110);
		}
		globalThis.setTimeout(blink, sleeping ? randomBetween(1800, 2400) : randomBetween(2600, 3200));
	};
	blink();
}

function bindMascotInteractions(mascot: HTMLButtonElement): void {
	prepareMascotSvg(mascot);
	// Leans/squashes the body group with scroll velocity; keeps its own rAF loop.
	bindScrollLean(mascot);
	let lastScrollMascotUpdate = 0;
	globalThis.addEventListener('pointermove', (event) => updateMascotTarget(mascot, event.clientX, event.clientY), { passive: true });
	mascot.addEventListener('pointerenter', () => setMascotMood(mascot, 'happy', 700));
	mascot.addEventListener('focus', () => setMascotMood(mascot, 'listening', 700));
	mascot.addEventListener('pointerdown', () => {
		setMascotMood(mascot, 'excited', 900, true);
		createPing(mascot);
	});
	mascot.addEventListener('dblclick', () => setMascotMood(mascot, 'love', 1800, true));
	globalThis.addEventListener('scroll', () => {
		const now = Date.now();
		if (now - lastScrollMascotUpdate < 900 || now < mascotState.lockedUntil || document.body.classList.contains('portal-open')) {
			return;
		}
		lastScrollMascotUpdate = now;
		setMascotMood(mascot, 'curious', 700, true);
		liftMascotBrows(mascot, 520);
	}, { passive: true });
	globalThis.addEventListener('blur', () => setMascotMood(mascot, 'bye', 1000, true));
	startMascotBlink(mascot);
	if (mascotState.frame !== undefined) {
		cancelAnimationFrame(mascotState.frame);
	}
	animateMascot(mascot);
}

function characterMarkup(): string {
	return `
		<button class="binocle" type="button" data-mood="curious" aria-label="Open Prismatica portal">
			${mascotSvgMarkup()}
			<span class="right-lens-hotspot" aria-hidden="true"></span>
		</button>`;
}

export function mountMascot(onOpenPortal?: () => void): void {
	const anchor = queryElement('#mascot-anchor', isHtmlElement);
	if (!anchor) {
		return;
	}
	setTrustedInnerHTML(anchor, characterMarkup());
	const mascot = queryElement('.binocle', isButton);
	if (mascot) {
		bindMascotInteractions(mascot);
		if (onOpenPortal) {
			mascot.addEventListener('click', () => onOpenPortal());
		}
	}
}

export function setMountedMascotMood(mood: MascotMood, duration: number): void {
	const mascot = queryElement('.binocle', isButton);
	if (mascot) {
		setMascotMood(mascot, mood, duration, true);
	}
}

export function notifyWithMascot(options: NotificationOptions, mascot: HTMLButtonElement | null = queryElement('.binocle', isButton)): void {
	notify(options);
	if (!mascot) {
		return;
	}
	const moodMap: Record<NotificationKind, MascotMood> = {
		success: 'happy',
		error: 'scared',
		warning: 'surprised',
		info: 'curious',
	};
	setMascotMood(mascot, moodMap[options.kind], 2000, true);
}

