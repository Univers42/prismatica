import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { bindScrollReveal } from '../../../src/lib/scroll-reveal';

describe('bindScrollReveal', () => {
	let observeMock: ReturnType<typeof vi.fn>;
	let unobserveMock: ReturnType<typeof vi.fn>;
	let intersectionCallback: IntersectionObserverCallback;

	beforeEach(() => {
		document.body.innerHTML = `
			<div data-scroll-rise id="target1"></div>
			<div data-reveal id="target2"></div>
			<div class="section__head" id="target3"></div>
			<div id="ignored"></div>
		`;

		observeMock = vi.fn();
		unobserveMock = vi.fn();

		// Mock IntersectionObserver
		window.IntersectionObserver = vi.fn().mockImplementation((cb) => {
			intersectionCallback = cb;
			return {
				observe: observeMock,
				unobserve: unobserveMock,
				disconnect: vi.fn(),
			};
		});

		// Mock matchMedia
		window.matchMedia = vi.fn().mockImplementation((query) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('adds reveal-prep and observes targets', () => {
		bindScrollReveal();

		const targets = document.querySelectorAll('#target1, #target2, #target3');
		targets.forEach((el) => {
			expect(el.classList.contains('reveal-prep')).toBe(true);
		});

		expect(observeMock).toHaveBeenCalledTimes(3);
		
		const ignored = document.getElementById('ignored');
		expect(ignored?.classList.contains('reveal-prep')).toBe(false);
	});

	it('adds is-revealed and unobserves on intersect', () => {
		bindScrollReveal();

		const target1 = document.getElementById('target1') as HTMLElement;
		
		// Simulate intersection
		intersectionCallback([{ isIntersecting: true, target: target1 }] as any, {} as any);

		expect(target1.classList.contains('is-revealed')).toBe(true);
		expect(unobserveMock).toHaveBeenCalledWith(target1);
	});

	it('ignores elements when prefers-reduced-motion is true (Devil Condition 1)', () => {
		// Override matchMedia to simulate reduced motion
		window.matchMedia = vi.fn().mockReturnValue({ matches: true });

		bindScrollReveal();

		const targets = document.querySelectorAll('#target1, #target2, #target3');
		targets.forEach((el) => {
			expect(el.classList.contains('reveal-prep')).toBe(false);
		});

		expect(observeMock).not.toHaveBeenCalled();
	});
});
