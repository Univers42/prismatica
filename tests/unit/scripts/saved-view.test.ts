import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindSavedView } from '../../../src/scripts/saved-view';

// The finished drawing is the default; the script only arms and plays it. Reduced motion has to
// leave it finished, and the play has to happen once.
class FakeObserver {
	static last: FakeObserver | undefined;
	observed = new Set<Element>();
	constructor(readonly callback: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void) {
		FakeObserver.last = this;
	}
	observe(el: Element): void {
		this.observed.add(el);
	}
	unobserve(el: Element): void {
		this.observed.delete(el);
	}
	disconnect(): void {
		this.observed.clear();
	}
}

const stubMotion = (reduced: boolean) =>
	vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced && query.includes('reduce'), media: query }));

describe('bindSavedView', () => {
	let figure: HTMLElement;

	beforeEach(() => {
		document.body.innerHTML = '<figure data-saved-view></figure>';
		figure = document.querySelector('[data-saved-view]') as HTMLElement;
		FakeObserver.last = undefined;
		vi.stubGlobal('IntersectionObserver', FakeObserver);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.replaceChildren();
	});

	it('leaves the finished drawing alone when motion is reduced', () => {
		stubMotion(true);
		bindSavedView();
		expect(figure.hasAttribute('data-armed')).toBe(false);
		expect(FakeObserver.last).toBeUndefined();
	});

	it('arms the drawing, plays it once it is on screen, then stops watching', () => {
		stubMotion(false);
		bindSavedView();
		expect(figure.hasAttribute('data-armed')).toBe(true);
		const observer = FakeObserver.last as FakeObserver;
		observer.callback([{ target: figure, isIntersecting: false }]);
		expect(figure.hasAttribute('data-play')).toBe(false);
		observer.callback([{ target: figure, isIntersecting: true }]);
		expect(figure.hasAttribute('data-play')).toBe(true);
		expect(observer.observed.has(figure)).toBe(false);
	});
});
