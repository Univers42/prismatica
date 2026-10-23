import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindSectionSpy } from '../../../src/lib/section-spy';

describe('bindSectionSpy', () => {
	let report: (visible: Record<string, boolean>) => void;
	let disconnect: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		document.body.innerHTML = `
			<nav>
				<a class="link" href="#apps">Apps</a>
				<a class="link" href="#pricing">Pricing</a>
				<a class="link" href="/docs/">Docs</a>
			</nav>
			<section id="apps"></section>
			<section id="pricing"></section>
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

	const current = () => [...document.querySelectorAll('[aria-current]')].map((link) => link.getAttribute('href'));

	it('marks the link of the section under the reading line', () => {
		bindSectionSpy(document.querySelectorAll<HTMLAnchorElement>('.link'));
		report({ apps: true });
		expect(current()).toEqual(['#apps']);
		report({ apps: false, pricing: true });
		expect(current()).toEqual(['#pricing']);
	});

	it('prefers the earlier section while two share the line', () => {
		bindSectionSpy(document.querySelectorAll<HTMLAnchorElement>('.link'));
		report({ pricing: true });
		report({ apps: true });
		expect(current()).toEqual(['#apps']);
	});

	it('clears the mark between linked sections', () => {
		bindSectionSpy(document.querySelectorAll<HTMLAnchorElement>('.link'));
		report({ apps: true });
		report({ apps: false });
		expect(current()).toEqual([]);
	});

	it('ignores links that do not point at a section on this page, and can be unbound', () => {
		const unbind = bindSectionSpy(document.querySelectorAll<HTMLAnchorElement>('.link'));
		const observed = vi.mocked(window.IntersectionObserver).mock.results[0]?.value as { observe: ReturnType<typeof vi.fn> };
		expect(observed.observe).toHaveBeenCalledTimes(2);
		unbind();
		expect(disconnect).toHaveBeenCalled();
	});
});
