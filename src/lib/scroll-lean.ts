// Leaning and squashing the binocular mascot with scroll velocity: the page
// motion makes it look like the character reacts to being scrolled, instead
// of scrolling past inert. Applied on `.binocle .svg-body-group` (see
// _mascot.scss), which reads the custom properties set here.
import { clamp } from './math';
import { motionAllowed } from './motion-preference';

/**
 * The lean gain. Caveat: hand-tuned, and the input velocity is normalised to
 * "px per frame" (16 ms) but scroll speed itself depends on the input device —
 * a wheel and a trackpad fling will not feel the same.
 */
const VELOCITY_GAIN = 0.04;
const LEAN_LIMIT_DEG = 7;
/**
 * Time constant of the critically-damped ease (first-order exponential step).
 * Caveat: 130 ms is tuned so the lean settles in roughly 400 ms from full
 * speed; other rates would need re-tuning of both the gain and this constant.
 */
const SETTLE_MS = 130;
/** Below this the lean counts as settled and the rAF loop stops. */
const SETTLE_EPSILON = 0.15;

/**
 * Eases one step toward the velocity-implied target lean.
 * `velocity` is in px per frame (one rAF tick, roughly 16 ms), `dtMs` is
 * elapsed real time in milliseconds. Clamped to ±LEAN_LIMIT_DEG.
 */
export function nextLean(current: number, velocity: number, dtMs: number): number {
	if (dtMs <= 0) {
		return current;
	}
	const target = clamp(velocity * VELOCITY_GAIN, -LEAN_LIMIT_DEG, LEAN_LIMIT_DEG);
	const blend = 1 - Math.exp(-dtMs / SETTLE_MS);
	return clamp(current + (target - current) * blend, -LEAN_LIMIT_DEG, LEAN_LIMIT_DEG);
}

/**
 * Binds a passive scroll listener that drives `--scroll-lean` (deg) and
 * `--scroll-squash` (unitless) on `el` from a rAF loop. The loop only runs
 * while the lean is not settled, and never when motion is not allowed.
 * Returns an unbind function.
 */
export function bindScrollLean(el: HTMLElement): () => void {
	if (!motionAllowed()) {
		return () => {};
	}
	let frame = 0;
	let lean = 0;
	let velocity = 0; // px per frame-ish, refreshed on every scroll event
	let lastY = window.scrollY;
	let lastScrollAt = 0;
	let lastFrameAt = 0;

	const apply = (): void => {
		el.style.setProperty('--scroll-lean', `${lean.toFixed(2)}deg`);
		el.style.setProperty('--scroll-squash', (1 - Math.abs(lean) / 100).toFixed(3));
	};

	const stop = (): void => {
		if (frame) {
			cancelAnimationFrame(frame);
			frame = 0;
		}
		lean = 0;
		apply();
	};

	const tick = (now: number): void => {
		const dt = lastFrameAt ? Math.max(now - lastFrameAt, 1) : 16;
		lastFrameAt = now;
		lean = nextLean(lean, velocity, dt);
		velocity = 0; // each frame consumes the queued velocity
		apply();
		if (Math.abs(lean) < SETTLE_EPSILON) {
			stop();
			return;
		}
		frame = requestAnimationFrame(tick);
	};

	const onScroll = (): void => {
		if (!motionAllowed()) {
			stop();
			return;
		}
		const now = performance.now();
		const y = window.scrollY;
		// Caveat: wheel events can arrive more often than frames; the 16 ms
		// normalisation can then read faster than the real page velocity.
		const dt = Math.max(now - lastScrollAt, 1);
		velocity = (y - lastY) * (16 / dt);
		lastY = y;
		lastScrollAt = now;
		if (!frame) {
			lastFrameAt = 0;
			frame = requestAnimationFrame(tick);
		}
	};

	window.addEventListener('scroll', onScroll, { passive: true });
	return () => {
		window.removeEventListener('scroll', onScroll);
		stop();
	};
}
