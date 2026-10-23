// The hero laptop runs the live workspace like a resizable app window: it is
// laid out at a logical width picked so that, zoomed to the screen, text and
// controls stay legible (TARGET_ZOOM), between the narrowest layout the app is
// designed for and its desktop width. Below 720 logical px the workspace's own
// container queries switch it to its phone layout. Below MIN_ZOOM its 44px
// controls would shrink under the 24px minimum target size, so there the app
// becomes a picture (inert); the app tour below offers the same apps.

import { motionAllowed } from '../lib/motion-preference';

export const MAX_APP_WIDTH = 960;
export const MIN_APP_WIDTH = 360;
export const TARGET_ZOOM = 0.6;
export const MIN_ZOOM = 0.55;
const SCREEN_RATIO = 16 / 10;

export type ScreenLayout = { width: number; height: number; zoom: number; usable: boolean };

export function screenLayout(screenWidth: number): ScreenLayout {
	const width = Math.round(Math.min(MAX_APP_WIDTH, Math.max(MIN_APP_WIDTH, screenWidth / TARGET_ZOOM)));
	const zoom = screenWidth / width;
	return { width, height: Math.round(width / SCREEN_RATIO), zoom, usable: zoom >= MIN_ZOOM };
}

export function bindLaptopScreen(screen: HTMLElement, app: HTMLElement): () => void {
	const apply = (screenWidth: number): void => {
		const { width, height, zoom, usable } = screenLayout(screenWidth);
		app.style.setProperty('--app-width', `${width}px`);
		app.style.setProperty('--app-height', `${height}px`);
		app.style.setProperty('--screen-zoom', zoom.toFixed(4));
		app.inert = !usable;
	};
	apply(screen.clientWidth);
	const observer = new ResizeObserver(([entry]) => {
		if (entry) apply(entry.contentRect.width);
	});
	observer.observe(screen);
	return () => observer.disconnect();
}

/** Page scroll in hundredths of the viewport height: the unit (vh) the hero's scroll ranges are written in. */
export function scrollInVh(scrollY: number, viewportHeight: number): number {
	return viewportHeight > 0 ? (scrollY / viewportHeight) * 100 : 0;
}

// Caveat: a time constant, not a measured feel. 140 ms closes 90% of a gap
// in about a third of a second: long enough to turn wheel notches into one
// glide, short enough that the lid never visibly trails the page.
export const SCRUB_SMOOTHING_MS = 140;

/** One frame of exponential easing from `current` toward `target`; snaps once within 0.01. */
export function easeToward(current: number, target: number, elapsedMs: number, smoothingMs = SCRUB_SMOOTHING_MS): number {
	const next = current + (target - current) * (1 - Math.exp(-Math.max(0, elapsedMs) / smoothingMs));
	return Math.abs(target - next) < 0.01 ? target : next;
}

// The device scene's scroll animations, eased: the stylesheets turn
// --scroll-vh into the negative delay of a paused animation
// (styles/components/_devices*.scss), and this moves it toward the page's
// scroll position a little each frame. Same path in every browser, including
// those without scroll-driven animations (Firefox 158). Scroll is read in the
// scroll event, so the frame only writes.
// Caveat: until this runs, a browser without scroll-driven animations shows
// the open laptop, so the lid can be seen closing on load.
export function bindScrollScrub(scene: HTMLElement): () => void {
	let target = scrollInVh(window.scrollY, window.innerHeight);
	let shown = target;
	let frame = 0;
	let lastFrameAt = 0;
	const write = (): void => scene.style.setProperty('--scroll-vh', shown.toFixed(2));
	const step = (now: number): void => {
		shown = easeToward(shown, target, lastFrameAt ? now - lastFrameAt : 16);
		lastFrameAt = now;
		write();
		frame = shown === target ? 0 : requestAnimationFrame(step);
		if (!frame) lastFrameAt = 0;
	};
	const onScroll = (): void => {
		target = scrollInVh(window.scrollY, window.innerHeight);
		if (!motionAllowed()) {
			shown = target;
			write();
		} else if (!frame) {
			frame = requestAnimationFrame(step);
		}
	};
	write();
	scene.dataset.scrollScrub = '';
	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onScroll, { passive: true });
	return () => {
		cancelAnimationFrame(frame);
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('resize', onScroll);
	};
}
