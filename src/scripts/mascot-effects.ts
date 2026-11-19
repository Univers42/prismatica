import { randomIndex, randomBetween } from '../lib/math';
import { type MascotMood, mascotState } from './mascot-state';

export function mascotMotionPaused(): boolean {
	return document.documentElement.classList.contains('motion-paused');
}

export function stopMascotEffects(mascot: HTMLButtonElement): void {
	globalThis.clearInterval(mascotState.heartTimer);
	globalThis.clearInterval(mascotState.zTimer);
	globalThis.clearInterval(mascotState.laughTimer);
	mascotState.heartTimer = undefined;
	mascotState.zTimer = undefined;
	mascotState.laughTimer = undefined;
	mascot.querySelectorAll('.binocle__heart, .binocle__z, .binocle__laugh, .binocle__laugh-tear, .binocle__ping').forEach((particle) => particle.remove());
}

export function createHeart(mascot: HTMLButtonElement): void {
	const heart = document.createElement('span');
	heart.className = 'binocle__heart';
	heart.dataset.glyph = ['♥', '♡', '✦'][randomIndex(3)] ?? '♥';
	heart.style.left = `${randomBetween(34, 34)}%`;
	heart.style.setProperty('--heart-x', `${randomBetween(-28, 56)}px`);
	mascot.append(heart);
	heart.addEventListener('animationend', () => heart.remove(), { once: true });
}

export function createSleepZ(mascot: HTMLButtonElement): void {
	const zed = document.createElement('span');
	zed.className = 'binocle__z';
	zed.dataset.glyph = 'Z';
	zed.style.left = `${randomBetween(54, 24)}%`;
	zed.style.setProperty('--z-x', `${randomBetween(-14, 42)}px`);
	mascot.append(zed);
	zed.addEventListener('animationend', () => zed.remove(), { once: true });
}

export function createLaughParticle(mascot: HTMLButtonElement): void {
	const laugh = document.createElement('span');
	laugh.className = 'binocle__laugh-tear';
	laugh.style.left = `${randomBetween(30, 44)}%`;
	laugh.style.top = `${randomBetween(18, 32)}%`;
	laugh.style.setProperty('--laugh-x', `${randomBetween(-30, 60)}px`);
	laugh.style.setProperty('--laugh-rot', `${randomBetween(-17, 34)}deg`);
	mascot.append(laugh);
	laugh.addEventListener('animationend', () => laugh.remove(), { once: true });
}

export function createPing(mascot: HTMLButtonElement): void {
	const ping = document.createElement('span');
	ping.className = 'binocle__ping';
	ping.style.left = `${randomBetween(48, 32)}%`;
	ping.style.top = `${randomBetween(30, 30)}%`;
	mascot.append(ping);
	ping.addEventListener('animationend', () => ping.remove(), { once: true });
}

export function startMascotStars(mascot: HTMLButtonElement): void {
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

export function liftMascotBrows(mascot: HTMLButtonElement, duration = 680): void {
	mascot.classList.remove('is-brow-pop');
	mascot.getBoundingClientRect();
	mascot.classList.add('is-brow-pop');
	globalThis.setTimeout(() => mascot.classList.remove('is-brow-pop'), duration);
}

export function startMascotMoodEffect(mascot: HTMLButtonElement, mood: MascotMood): void {
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

export function wakeMascotPose(mascot: HTMLButtonElement): void {
	mascot.style.setProperty('--blink', '1');
	mascot.style.setProperty('--tilt', '0deg');
	mascotState.targetHeadX = 0;
	mascotState.targetHeadY = 0;
	mascotState.headX *= 0.35;
	mascotState.headY *= 0.35;
}

export function sleepMascotPose(mascot: HTMLButtonElement): void {
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