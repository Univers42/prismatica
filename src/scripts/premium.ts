/* ==========================================================================
 * premium.ts — tactile "wow" interactions for the marketing site.
 *
 * All effects are progressive enhancement: they no-op under
 * prefers-reduced-motion, and pointer-driven effects (tilt, magnetic) only
 * bind on fine pointers (mouse/trackpad), never touch. Bundled by Astro so it
 * runs under the strict production `script-src 'self'` CSP.
 * ========================================================================== */

const prefersReducedMotion = (): boolean =>
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = (): boolean => window.matchMedia('(pointer: fine)').matches;

/** Subtle 3D parallax tilt on [data-tilt] elements (tilts an inner
 *  [data-tilt-target] if present, else the element itself). */
function initTilt(): void {
	if (prefersReducedMotion() || !finePointer()) return;
	const MAX_DEG = 6;
	for (const el of document.querySelectorAll<HTMLElement>('[data-tilt]')) {
		const target = el.querySelector<HTMLElement>('[data-tilt-target]') ?? el;
		el.addEventListener('pointermove', (event) => {
			const rect = el.getBoundingClientRect();
			const px = (event.clientX - rect.left) / rect.width - 0.5;
			const py = (event.clientY - rect.top) / rect.height - 0.5;
			target.style.transform =
				`perspective(1100px) rotateX(${(-py * MAX_DEG).toFixed(2)}deg) rotateY(${(px * MAX_DEG).toFixed(2)}deg)`;
		});
		el.addEventListener('pointerleave', () => { target.style.transform = ''; });
	}
}

/** Magnetic pull toward the cursor on [data-magnetic] controls. */
function initMagnetic(): void {
	if (prefersReducedMotion() || !finePointer()) return;
	const STRENGTH = 0.28;
	for (const el of document.querySelectorAll<HTMLElement>('[data-magnetic]')) {
		el.addEventListener('pointermove', (event) => {
			const rect = el.getBoundingClientRect();
			const x = (event.clientX - rect.left - rect.width / 2) * STRENGTH;
			const y = (event.clientY - rect.top - rect.height / 2) * STRENGTH;
			el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
		});
		el.addEventListener('pointerleave', () => { el.style.transform = ''; });
	}
}

/** Count [data-count-to] numbers up from 0 when they scroll into view. */
function initCounters(): void {
	const els = document.querySelectorAll<HTMLElement>('[data-count-to]');
	if (els.length === 0) return;
	// Reduced motion / no IO: leave the server-rendered final value in place.
	if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
	const io = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			const el = entry.target as HTMLElement;
			io.unobserve(el);
			const to = Number(el.dataset.countTo) || 0;
			const prefix = el.dataset.countPrefix ?? '';
			const suffix = el.dataset.countSuffix ?? '';
			const duration = 950;
			const start = performance.now();
			const tick = (now: number): void => {
				const t = Math.min(1, (now - start) / duration);
				const eased = 1 - Math.pow(1 - t, 3);
				el.textContent = prefix + String(Math.round(to * eased)) + suffix;
				if (t < 1) requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		}
	}, { threshold: 0.6 });
	els.forEach((el) => io.observe(el));
}

function initPremium(): void {
	initTilt();
	initMagnetic();
	initCounters();
}

/** Defer decorative setup off the critical path so binding listeners /
 *  observers never inflates Total Blocking Time. Tilt/magnetic are desktop-only
 *  hover effects and the counters live below the fold, so a short idle wait is
 *  imperceptible. Mirrors main.ts's whenIdle (kept local to avoid a circular
 *  import — main.ts imports this module). */
function whenIdle(fn: () => void): void {
	const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback;
	if (typeof ric === 'function') ric(fn, { timeout: 2000 });
	else window.setTimeout(fn, 200);
}

const bootPremium = (): void => whenIdle(initPremium);

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', bootPremium, { once: true });
} else {
	bootPremium();
}
