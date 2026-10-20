import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

type RevealModule = typeof import('../../../src/lib/scroll-reveal');

function mockMatchMedia(reduce: boolean): void {
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: reduce,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	}));
}

// motion-preference caches its media query, so each test loads a fresh copy.
async function loadReveal(): Promise<RevealModule> {
	vi.resetModules();
	return import('../../../src/lib/scroll-reveal');
}

describe('bindScrollReveal', () => {
	let observeMock: ReturnType<typeof vi.fn>;
	let unobserveMock: ReturnType<typeof vi.fn>;
	let intersectionCallback: IntersectionObserverCallback;

	beforeEach(() => {
		document.body.innerHTML = `
			<div data-scroll-rise id="target1"></div>
			<div data-reveal="head" id="target2"></div>
			<div class="section__head" id="target3"></div>
			<div id="ignored"></div>
		`;

		observeMock = vi.fn();
		unobserveMock = vi.fn();
		window.IntersectionObserver = vi.fn().mockImplementation((cb: IntersectionObserverCallback) => {
			intersectionCallback = cb;
			return { observe: observeMock, unobserve: unobserveMock, disconnect: vi.fn() };
		});
		mockMatchMedia(false);
	});

	afterEach(() => {
		document.documentElement.classList.remove('motion-paused');
		vi.restoreAllMocks();
	});

	it('adds reveal-prep and observes targets', async () => {
		(await loadReveal()).bindScrollReveal();

		document.querySelectorAll('#target1, #target2, #target3').forEach((el) => {
			expect(el.classList.contains('reveal-prep')).toBe(true);
		});
		expect(observeMock).toHaveBeenCalledTimes(3);
		expect(document.getElementById('ignored')?.classList.contains('reveal-prep')).toBe(false);
	});

	it('adds is-revealed and unobserves on intersect', async () => {
		(await loadReveal()).bindScrollReveal();
		const target1 = document.getElementById('target1') as HTMLElement;

		intersectionCallback([{ isIntersecting: true, target: target1 }] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver);

		expect(target1.classList.contains('is-revealed')).toBe(true);
		expect(unobserveMock).toHaveBeenCalledWith(target1);
	});

	it('cascades elements that enter together in page order, not callback order', async () => {
		(await loadReveal()).bindScrollReveal();
		const [first, second, third] = ['target1', 'target2', 'target3'].map((id) => document.getElementById(id) as HTMLElement);
		const entering = [third, first, second].map((target) => ({ isIntersecting: true, target }));

		intersectionCallback(entering as unknown as IntersectionObserverEntry[], {} as IntersectionObserver);

		expect(first?.style.getPropertyValue('--reveal-delay')).toBe('0ms');
		expect(second?.style.getPropertyValue('--reveal-delay')).toBe('70ms');
		expect(third?.style.getPropertyValue('--reveal-delay')).toBe('140ms');
	});

	it('leaves content untouched under reduced motion', async () => {
		mockMatchMedia(true);
		(await loadReveal()).bindScrollReveal();

		document.querySelectorAll('#target1, #target2, #target3').forEach((el) => {
			expect(el.classList.contains('reveal-prep')).toBe(false);
		});
		expect(observeMock).not.toHaveBeenCalled();
	});

	it('leaves content untouched while the visitor has paused motion', async () => {
		document.documentElement.classList.add('motion-paused');
		(await loadReveal()).bindScrollReveal();

		expect(document.getElementById('target1')?.classList.contains('reveal-prep')).toBe(false);
		expect(observeMock).not.toHaveBeenCalled();
	});
});

describe('staggerDelay', () => {
	it('spaces siblings 70 ms apart and stops growing after five steps', async () => {
		const { staggerDelay } = await loadReveal();
		expect([0, 1, 2, 5, 9].map(staggerDelay)).toEqual([0, 70, 140, 350, 350]);
	});
});
