// The newsletter form's submit, loaded by main.ts on the first submit so the footer form costs no
// JavaScript until it is used. The gateway sends the double opt-in mail; nothing is subscribed
// until the visitor opens /newsletter/confirm from it.
import { NEWSLETTER_INTENT_KEY, POLICY_VERSION } from '../data/legal';
import { validateEmailFormat } from '../lib/email-validation';
import { writeStorage } from '../lib/storage';
import { notify } from './notifications';

type NewsletterFields = {
	email: HTMLInputElement;
	consent: HTMLInputElement;
	status: HTMLOutputElement;
	button: HTMLButtonElement;
};

function newsletterFields(form: HTMLFormElement): NewsletterFields | null {
	const email = form.elements.namedItem('email');
	const consent = form.elements.namedItem('newsletter_consent');
	const status = form.querySelector('[data-newsletter-status]');
	const button = form.querySelector('button[type="submit"]');
	if (!(email instanceof HTMLInputElement) || !(consent instanceof HTMLInputElement)) return null;
	if (!(status instanceof HTMLOutputElement) || !(button instanceof HTMLButtonElement)) return null;
	return { email, consent, status, button };
}

async function requestSubscription(email: string): Promise<string> {
	const response = await fetch('/api/newsletter/subscribe', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email }),
	});
	const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
	if (!response.ok) throw new Error(data.error ?? data.message ?? 'newsletter_failed');
	return data.message ?? 'Check your inbox to confirm the subscription.';
}

function refuse(fields: NewsletterFields, field: HTMLInputElement, message: string): void {
	fields.status.textContent = message;
	field.setAttribute('aria-invalid', 'true');
	field.focus();
}

export async function submitNewsletter(form: HTMLFormElement): Promise<void> {
	const fields = newsletterFields(form);
	if (!fields || fields.button.disabled) return;
	const email = fields.email.value.trim();
	const check = validateEmailFormat(email, true, fields.email.validity.valid);
	if (!check.valid) return refuse(fields, fields.email, check.message);
	fields.email.removeAttribute('aria-invalid');
	if (!fields.consent.checked) return refuse(fields, fields.consent, 'Tick the consent box to subscribe.');
	fields.consent.removeAttribute('aria-invalid');

	fields.button.disabled = true;
	fields.status.textContent = 'Sending…';
	try {
		const message = await requestSubscription(email);
		writeStorage(NEWSLETTER_INTENT_KEY, JSON.stringify({ email, pendingDoubleOptIn: true, policyVersion: POLICY_VERSION, savedAt: new Date().toISOString() }));
		fields.status.textContent = message;
		notify({ kind: 'success', title: 'Almost there', message, duration: 0 });
	} catch (error) {
		const message = error instanceof Error && error.message !== 'newsletter_failed' ? error.message : 'Could not send. Try again in a minute.';
		fields.status.textContent = message;
		notify({ kind: 'error', title: 'Could not subscribe', message, duration: 8000 });
	} finally {
		fields.button.disabled = false;
	}
}
