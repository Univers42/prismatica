import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bindSkipLinkFocus } from './a11y';

describe('bindSkipLinkFocus', () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<a href="#content" class="skip-link">Skip to content</a>
			<a href="#missing" class="skip-link">Skip to missing</a>
			
			<main id="content">
				<h1>Main Heading</h1>
				<p>Some text</p>
			</main>

			<a href="#existing-tabindex" class="skip-link">Skip to existing</a>
			<div id="existing-tabindex">
				<h2 tabindex="0">Heading with tabindex</h2>
			</div>
		`;
		bindSkipLinkFocus();
	});

	it('adds temporary tabindex and focuses target, removing it on blur', () => {
		const link = document.querySelector('a[href="#content"]') as HTMLAnchorElement;
		const targetHeading = document.querySelector('#content h1') as HTMLElement;
		
		const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			cb(0);
			return 0;
		});

		link.click();

		expect(targetHeading.getAttribute('tabindex')).toBe('-1');
		expect(document.activeElement).toBe(targetHeading);

		// Trigger blur
		const blurEvent = new Event('blur');
		targetHeading.dispatchEvent(blurEvent);
		
		expect(targetHeading.hasAttribute('tabindex')).toBe(false);

		rafSpy.mockRestore();
	});

	it('preserves existing tabindex on blur (Devil condition 1)', () => {
		const link = document.querySelector('a[href="#existing-tabindex"]') as HTMLAnchorElement;
		const targetHeading = document.querySelector('#existing-tabindex h2') as HTMLElement;
		
		const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			cb(0);
			return 0;
		});

		link.click();

		// Should not override existing tabindex
		expect(targetHeading.getAttribute('tabindex')).toBe('0');
		expect(document.activeElement).toBe(targetHeading);

		// Trigger blur
		const blurEvent = new Event('blur');
		targetHeading.dispatchEvent(blurEvent);
		
		// Value must remain untouched
		expect(targetHeading.getAttribute('tabindex')).toBe('0');

		rafSpy.mockRestore();
	});
});
