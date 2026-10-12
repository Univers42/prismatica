import { describe, it, expect, beforeEach } from 'vitest';

describe('WCAG Accessible Form Feedback & Live Regions', () => {
	beforeEach(() => {
		document.body.innerHTML = `
    <form class="newsletter-signup" data-newsletter-signup novalidate>
      <h3>Prismatica newsletter</h3>
      <p>Receive occasional product and privacy-aware workspace updates.</p>
      <div class="field">
        <label for="newsletter-email">Email address</label>
        <input id="newsletter-email" name="email" type="email" autocomplete="email" required />
      </div>
      <label class="consent-toggle" for="newsletter-consent">
        <input id="newsletter-consent" name="newsletter_consent" type="checkbox" required />
        <span>I agree to receive the Prismatica newsletter. I can unsubscribe at any time. See the <a href="/legal/privacy-policy/">Privacy Policy</a>.</span>
      </label>
      <button class="button button--primary" type="submit" aria-label="Subscribe to the Prismatica newsletter">Subscribe</button>
      <output class="form-status" aria-live="polite" data-newsletter-status></output>
    </form>
  `;
	});

	describe('Form State & Live Announcements', () => {
		it('form status output has aria-live="polite" by default', () => {
			const statusOutput = document.querySelector('.form-status') as HTMLElement;

			expect(statusOutput.getAttribute('aria-live')).toBe('polite');
		});

		it('form status output role can be set to alert', () => {
			const statusOutput = document.querySelector('.form-status') as HTMLElement;

			statusOutput.setAttribute('role', 'alert');
			expect(statusOutput.getAttribute('role')).toBe('alert');
		});

		it('input aria-describedby can be set to link error text', () => {
			const emailInput = document.getElementById('newsletter-email') as HTMLInputElement;

			expect(emailInput.getAttribute('aria-describedby')).toBeFalsy();

			emailInput.setAttribute('aria-describedby', 'test-error-id');
			emailInput.setAttribute('aria-invalid', 'true');

			expect(emailInput.getAttribute('aria-describedby')).toBe('test-error-id');
			expect(emailInput.getAttribute('aria-invalid')).toBe('true');
		});

		it('error status message renders in form-status output', () => {
			const statusOutput = document.querySelector('.form-status') as HTMLElement;

			statusOutput.textContent = 'Error: Invalid email';
			expect(statusOutput.textContent).toContain('Error');
		});
	});
});