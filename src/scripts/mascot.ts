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

const SHELL_LEFT = 'M15 34 C26 20, 51 16, 69 27 C80 34, 87 48, 86 62 C85 78, 73 90, 55 94 C34 98, 14 90, 7 75 C1 61, 4 45, 15 34Z';
const SHELL_RIGHT = 'M115 27 C134 16, 158 20, 169 34 C180 49, 183 65, 177 78 C170 92, 150 98, 129 94 C111 90, 99 78, 98 62 C97 48, 104 34, 115 27Z';
// Each barrel is the shell repeated and stepped back along --tube-x/y; the
// SCSS loop over $tube-slices in _mascot.scss styles exactly this many.
const TUBE_SLICES = 6;

function tubeSlices(shell: string): string {
	return Array.from({ length: TUBE_SLICES }, () => `<path class="svg-tube" d="${shell}" />`).join('');
}

// Decorative: the button around it carries the name, and a titled SVG inside
// a labelled button gives it text its label does not contain (WCAG 2.5.3).
function mascotSvgMarkup(): string {
	return `
		<svg class="binocle__svg" viewBox="0 0 184 118" aria-hidden="true">
			<g class="svg-body-group">
				<path class="svg-arm left" d="M49 31 C39 18, 25 18, 19 32" />
				<path class="svg-arm right" d="M135 31 C147 18, 161 19, 166 33" />
				<g class="svg-tube-stack">${tubeSlices(SHELL_LEFT)}</g>
				<g class="svg-tube-stack">${tubeSlices(SHELL_RIGHT)}</g>
				<g class="svg-volume">
					<path class="svg-shell left" d="${SHELL_LEFT}" />
					<path class="svg-shell right" d="${SHELL_RIGHT}" />
				</g>
				<path class="svg-barrel left" d="M20 39 C29 28, 47 25, 62 32 C50 29, 33 32, 24 43 C16 54, 16 67, 24 77 C12 69, 9 51, 20 39Z" />
				<path class="svg-barrel right" d="M122 32 C136 25, 154 28, 164 39 C175 51, 172 69, 160 77 C168 67, 168 54, 160 43 C151 32, 134 29, 122 32Z" />
				<ellipse class="svg-frame left-frame" cx="43" cy="57" rx="39" ry="34" />
				<ellipse class="svg-frame right-frame" cx="141" cy="57" rx="39" ry="34" />
				<ellipse class="svg-inner-rim" cx="43" cy="57" rx="28" ry="24" />
				<ellipse class="svg-inner-rim" cx="141" cy="57" rx="28" ry="24" />
				<ellipse class="svg-rim" cx="38" cy="53" rx="24" ry="20" />
				<ellipse class="svg-rim" cx="136" cy="53" rx="24" ry="20" />
				<path class="svg-center-band" d="M84 53 C88 48, 96 48, 100 53" />
				<path class="svg-center-band" d="M86 67 C90 71, 95 71, 99 67" />
				<path class="svg-bridge-shadow" d="M99 62 C103 54, 110 54, 114 62" />
				<path class="svg-bridge" d="M80 61 C84 51, 91 48, 97 52 C101 55, 104 59, 108 62 C110 63, 112 63, 114 62" />
				<path class="svg-detail" d="M16 55 C20 34, 36 24, 56 28" />
				<path class="svg-detail" d="M19 62 C21 76, 35 86, 52 85" />
				<path class="svg-detail" d="M118 28 C139 23, 158 34, 164 55" />
				<path class="svg-detail" d="M162 63 C159 78, 145 86, 129 84" />
				<path class="svg-stitch" d="M28 80 C40 86, 57 85, 67 77" />
				<path class="svg-stitch" d="M123 77 C134 86, 152 85, 162 78" />
				<path class="svg-brow left" d="M22 20 C34 14, 54 14, 66 21" />
				<path class="svg-brow right" d="M118 21 C130 14, 151 14, 163 20" />
				<ellipse class="svg-cheek left" cx="22" cy="68" rx="10" ry="7" />
				<ellipse class="svg-cheek right" cx="162" cy="68" rx="10" ry="7" />
				<path class="svg-sweat" d="M166 32 C173 42, 172 50, 165 53 C158 48, 158 40, 166 32Z" />
				<path class="svg-tear" d="M157 69 C164 79, 163 87, 156 90 C149 85, 150 77, 157 69Z" />
				<g class="svg-stars"><path class="svg-star" d="M23 13 L26 20 L33 21 L28 26 L29 33 L23 29 L17 33 L18 26 L13 21 L20 20Z" /><path class="svg-star" d="M159 10 L162 17 L169 18 L164 23 L165 30 L159 26 L153 30 L154 23 L149 18 L156 17Z" /><path class="svg-star" d="M94 5 L96 11 L102 12 L98 16 L99 22 L94 19 L89 22 L90 16 L86 12 L92 11Z" /></g>
				<path class="svg-spiral left" d="M33 56 C33 48, 47 47, 48 56 C49 66, 36 67, 36 58 C36 53, 43 53, 43 58" />
				<path class="svg-spiral right" d="M131 56 C131 48, 145 47, 146 56 C147 66, 134 67, 134 58 C134 53, 141 53, 141 58" />
				<g class="svg-eye left"><circle class="svg-pupil" cx="43" cy="57" r="11.4" /><circle class="svg-pupil-shine" cx="38.8" cy="52.8" r="2.7" /></g>
				<g class="svg-eye right"><circle class="svg-pupil" cx="141" cy="57" r="11.4" /><circle class="svg-pupil-shine" cx="136.8" cy="52.8" r="2.7" /></g>
				<path class="svg-pupil-heart left" d="M43 52 C43 46, 35 43, 32 50 C29 57, 43 66, 43 66 C43 66, 57 57, 54 50 C51 43, 43 46, 43 52Z" />
				<path class="svg-pupil-heart right" d="M141 52 C141 46, 133 43, 130 50 C127 57, 141 66, 141 66 C141 66, 155 57, 152 50 C149 43, 141 46, 141 52Z" />
				<g class="svg-thought-bubble"><circle cx="14" cy="30" r="2.5" /><circle cx="9" cy="22" r="4" /><circle cx="5" cy="13" r="6" /></g>
				<ellipse class="svg-mouth-pad" cx="92" cy="96" rx="23" ry="15" />
				<path class="svg-mouth smile" d="M76 93 C83 105, 101 105, 108 93" />
				<path class="svg-mouth ajar" d="M78 94 C84 102, 100 102, 106 94 C101 99, 84 99, 78 94Z" />
				<path class="svg-mouth open" d="M77 93 C77 80, 86 73, 93 73 C102 73, 111 81, 110 94 C109 108, 99 115, 91 115 C83 115, 77 107, 77 93Z" />
				<path class="svg-mouth-core" d="M83 95 C83 85, 88 80, 93 80 C100 80, 105 86, 104 96 C103 106, 96 110, 91 110 C85 110, 83 104, 83 95Z" />
				<ellipse class="svg-mouth-shine" cx="88" cy="88" rx="3" ry="2.2" />
				<path class="svg-mouth flat" d="M81 96 C87 98, 98 98, 103 96" />
				<path class="svg-mouth grimace" d="M80 91 C87 89, 98 89, 105 91 L104 101 C97 104, 86 104, 80 101Z" />
				<path class="svg-mouth teeth" d="M80 92 L106 92 M84 92 L84 101 M90 92 L90 102 M96 92 L96 102 M102 92 L102 101" />
				<ellipse class="svg-mouth ooh" cx="92" cy="95" rx="8" ry="10" />
				<path class="svg-mouth tremble" d="M78 96 C82 91, 86 101, 90 96 C94 91, 98 101, 104 95" />
				<path class="svg-mouth smirk" d="M80 97 C84 103, 96 104, 106 95" />
				<path class="svg-mouth silly-open" d="M78 92 C78 80, 86 73, 93 73 C102 73, 110 81, 110 92" />
				<ellipse class="svg-mouth silly-tongue" cx="92" cy="100" rx="9" ry="7" />
				<path class="svg-mouth zip" d="M80 96 L106 96 M84 93 L88 99 M88 93 M92 99 M92 93 L96 99 M96 93 L100 99 M100 93 L104 99" />
				<path class="svg-spark" d="M117 84 L124 78 M119 92 L128 93 M112 91 L106 96" />
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
	heart.dataset.glyph = ['♥', '♡', '✦'][randomIndex(3)] ?? '♥';
	heart.style.left = `${randomBetween(34, 34)}%`;
	heart.style.setProperty('--heart-x', `${randomBetween(-28, 56)}px`);
	mascot.append(heart);
	heart.addEventListener('animationend', () => heart.remove(), { once: true });
}

function createSleepZ(mascot: HTMLButtonElement): void {
	const zed = document.createElement('span');
	zed.className = 'binocle__z';
	zed.dataset.glyph = 'Z';
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

