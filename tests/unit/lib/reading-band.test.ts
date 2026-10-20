import { beforeEach, describe, expect, it, vi } from 'vitest';
import { observeReadingBand } from '../../../src/lib/reading-band';

describe('observeReadingBand', () => {
	// Same mock style as section-spy.test.ts: capture the observer callback so
	// tests can decide what is in the band on each "scroll" tick.
	let report: (visible: Record<string, boolean>) => void;
	let disconnect: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		document.body.innerHTML = `
			<div id="one"></div>
			<div id="two"></div>
			<div id="three"></div>
		`;
		disconnect = vi.fn();
		window.IntersectionObserver = vi.fn().mockImplementation((callback: IntersectionObserverCallback) => {
			report = (visible) => callback(
				Object.entries(visible).map(([id, isIntersecting]) => ({ target: document.getElementById(id), isIntersecting })) as unknown as IntersectionObserverEntry[],
				{} as IntersectionObserver,
			);
			return { observe: vi.fn(), unobserve: vi.fn(), disconnect };
		}) as unknown as typeof IntersectionObserver;
	});

	const targets = () => [...document.querySelectorAll<HTMLElement>('[id]')];

	it('reports the first visible target and stays quiet while nothing is in the band', () => {
		const seen: Array<string | null> = [];
		observeReadingBand(targets(), (active) => seen.push(active?.id ?? null));
		report({ two: false });
		expect(seen).toEqual([]);
		report({ two: true });
		expect(seen).toEqual(['two']);
	});

	it('prefers the earlier target when two are visible', () => {
		const seen: Array<string | null> = [];
		observeReadingBand(targets(), (active) => seen.push(active?.id ?? null));
		report({ three: true });
		report({ one: true });
		expect(seen).toEqual(['three', 'one']);
	});

	it('reports null once every target has left the band', () => {
		const seen: Array<string | null> = [];
		observeReadingBand(targets(), (active) => seen.push(active?.id ?? null));
		report({ two: true });
		report({ two: false });
		expect(seen).toEqual(['two', null]);
	});

	it('does not call onChange twice for the same active target', () => {
		const seen: Array<string | null> = [];
		observeReadingBand(targets(), (active) => seen.push(active?.id ?? null));
		report({ two: true });
		report({ two: true, three: true });
		expect(seen).toEqual(['two']);
	});

	it('disconnects the observer on the returned stop function', () => {
		observeReadingBand(targets(), () => {});
		const observed = vi.mocked(window.IntersectionObserver).mock.results[0]?.value as { disconnect: unknown };
		expect(typeof observed.disconnect).toBe('function');
	});
});
