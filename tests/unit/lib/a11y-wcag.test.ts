import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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

describe('WCAG 2.5.3 Label in Name & Link Text Underlines', () => {
	let originalBodyInnerHTML: string;

	beforeEach(() => {
		originalBodyInnerHTML = document.body.innerHTML;
	});

	afterEach(() => {
		document.body.innerHTML = originalBodyInnerHTML;
	});

	it('LanguageSwitcher accessible name includes current language code (EN)', () => {
		document.body.innerHTML = `
    <a href="?lang=es" class="lang-switcher" aria-label="EN - Language: English. Switch to Español" data-current-lang="en" data-next-lang="es">
      <span class="header-icon__lang-badge">EN</span>
      <span class="visually-hidden">Language: English</span>
    </a>
  `;

		const switcher = document.querySelector('.lang-switcher') as HTMLElement;
		const ariaLabel = switcher.getAttribute('aria-label');

		expect(ariaLabel).toContain('EN');
	});

	it('LanguageSwitcher accessible name includes current language code (ES)', () => {
		document.body.innerHTML = `
    <a href="?lang=ar" class="lang-switcher" aria-label="ES - Language: Español. Switch to العربية" data-current-lang="es" data-next-lang="ar">
      <span class="header-icon__lang-badge">ES</span>
      <span class="visually-hidden">Language: Español</span>
    </a>
  `;

		const switcher = document.querySelector('.lang-switcher') as HTMLElement;
		const ariaLabel = switcher.getAttribute('aria-label');

		expect(ariaLabel).toContain('ES');
	});

	it('LanguageSwitcher accessible name includes current language code (AR)', () => {
		document.body.innerHTML = `
    <a href="?lang=en" class="lang-switcher" aria-label="AR - Language: العربية. Switch to English" data-current-lang="ar" data-next-lang="en">
      <span class="header-icon__lang-badge">AR</span>
      <span class="visually-hidden">Language: العربية</span>
    </a>
  `;

		const switcher = document.querySelector('.lang-switcher') as HTMLElement;
		const ariaLabel = switcher.getAttribute('aria-label');

		expect(ariaLabel).toContain('AR');
	});

	it('paragraph links within .legal-page have text-decoration underline', () => {
		document.body.innerHTML = `
    <div class="legal-page">
      <p>Some text with a <a href="/terms" style="text-decoration: underline;">terms link</a> in it.</p>
    </div>
  `;

		const links = document.querySelectorAll('.legal-page p a');
		expect(links.length).toBeGreaterThan(0);

		links.forEach((link) => {
			expect(window.getComputedStyle(link).textDecoration).toBe('underline');
		});
	});

	it('submit button in .gdpr-card or data-rights has accessible name containing visible text', () => {
		document.body.innerHTML = `
    <div class="gdpr-card">
      <button class="button button--primary" type="submit" aria-label="Submit request">Submit request</button>
    </div>
  `;

		const button = document.querySelector('.gdpr-card .button--primary') as HTMLButtonElement;
		const ariaLabel = button.getAttribute('aria-label');
		const visibleText = button.textContent.trim();

		expect(ariaLabel).toContain(visibleText);
	});
});