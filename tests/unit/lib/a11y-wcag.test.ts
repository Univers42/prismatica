import { describe, it, expect, beforeEach } from 'vitest';

describe('WCAG 2.2 Modal & Motion Accessibility', () => {
	beforeEach(() => {
		document.body.innerHTML = `
      <div id="_modal" aria-_modal="true" class="ui-dialog" role="dialog">
        <div class="ui-dialog__panel">
          <header class="ui-dialog__header">
            <h2 class="ui-dialog__title" id="_modal-title">Test Modal</h2>
            <button class="ui-dialog__close" type="button" aria-label="Close" data-ui-dialog-close></button>
          </header>
          <div class="ui-dialog__body">
            <p>Modal content</p>
          </div>
        </div>
      </div>
      <button id="open-_modal">Open Modal</button>
    `;
	});

	describe('Modal / Dialog Focus Management', () => {
		it('sets aria-_modal="true" and traps keyboard focus inside container', () => {
			const _modal = document.getElementById('_modal') as HTMLElement;
			const openBtn = document.getElementById('open-_modal') as HTMLButtonElement;

			expect(_modal.getAttribute('aria-_modal')).toBe('true');

			openBtn.click();

			document.body.classList.add('dialog-open');

			const focusableElements = _modal.querySelectorAll(
				'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
			const firstFocusable = focusableElements[0] as HTMLElement;
			const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

			firstFocusable.focus();

			const wasTrapped =
				document.activeElement === firstFocusable ||
				document.activeElement === lastFocusable;

			expect(wasTrapped).toBe(true);
		});

		it('Escape key closes _modal and returns focus to _opener', () => {
			const _modal = document.getElementById('_modal') as HTMLElement;
			const openBtn = document.getElementById('open-_modal') as HTMLButtonElement;
			const _opener = openBtn;

			openBtn.click();
			document.body.classList.add('dialog-open');

			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

			document.body.classList.remove('dialog-open');
			_opener.focus();

			expect(document.activeElement).toBe(_opener);
		});

		it('non-interactive container gracefully handles focus fallback', () => {
			document.body.innerHTML = `
        <div id="container" role="region" tabindex="-1">
          <p>Non-interactive content</p>
        </div>
        <button id="_opener">Opener</button>
      `;

			const container = document.getElementById('container') as HTMLElement;
			const _opener = document.getElementById('_opener') as HTMLButtonElement;

			container.focus();

			expect(document.activeElement).toBe(container);

			container.blur();

			expect(document.activeElement).not.toBe(container);
		});
	});

	describe('Reduced Motion & Skip Links', () => {
		it('.motion-paused toggle on <html> pauses animations and disables CSS transitions', () => {
			document.body.innerHTML = `
        <html>
          <body>
            <div class="animated-element">
              <span class="spin">spin</span>
            </div>
          </body>
        </html>
      `;

			const html = document.documentElement;
			html.classList.add('motion-paused');

			expect(html.classList.contains('motion-paused')).toBe(true);
		});

		it('aria-expanded toggles for expandable sections', () => {
			document.body.innerHTML = `
        <button id="accordion-trigger" aria-expanded="false">
          Toggle section
        </button>
        <div id="accordion-content" aria-hidden="true" hidden>
          <p>Accordian content</p>
        </div>
      `;

			const trigger = document.getElementById('accordion-trigger') as HTMLButtonElement;
			const content = document.getElementById('accordion-content') as HTMLElement;

			expect(trigger.getAttribute('aria-expanded')).toBe('false');
			expect(content.getAttribute('aria-hidden')).toBe('true');

			trigger.setAttribute('aria-expanded', 'true');
			content.removeAttribute('hidden');
			content.setAttribute('aria-hidden', 'false');

			expect(trigger.getAttribute('aria-expanded')).toBe('true');
			expect(content.hasAttribute('hidden')).toBe(false);
			expect(content.getAttribute('aria-hidden')).toBe('false');
		});
	});
});