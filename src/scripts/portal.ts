import { trustedHTML, insertTrustedHTML, queryElement, queryElements, isButton, isHtmlElement, isInput } from '../lib/dom-utils';
import { authConfig } from '../lib/auth-config';
import { type AuthResult, type AvailabilityFieldResult, type RegisterProfile, useAuth, validatePassword } from '../hooks/useAuth';
import { checkPasswordStrength, passwordRuleResults } from '../lib/auth-validation';
import { setMountedMascotMood, notifyWithMascot } from './mascot';
import { announce, ensureButtonLabels } from './theme';
import { readConsentPreferences } from './consent';
import { NEWSLETTER_INTENT_KEY } from '../data/legal';
import { readStorage } from '../lib/storage';
import { MiniBaasError } from '@grobase/js';
import { createPublicBaasClient } from '../lib/baas-client';

export type PortalMode = 'start' | 'connect';

type TurnstileApi = {
	render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void }) => string;
	reset?: (widgetId?: string) => void;
};

type TrustedHtmlPolicy = {
	createHTML: (markup: string) => unknown;
};

type TrustedTypesFactory = {
	createPolicy: (name: string, rules: { createHTML: (markup: string) => string }) => TrustedHtmlPolicy;
};

type AuthModeControls = {
	title: Element | null;
	note: Element | null;
	registerBtn: Element | null;
	loginBtn: Element | null;
	submitBtn: Element | null;
	usernameWrap: Element | null;
	confirmPasswordWrap: Element | null;
	termsConsent: Element | null;
	emailVerification: Element | null;
	email: Element | null;
	username: Element | null;
	emailVerificationConsent: Element | null;
	password: Element | null;
	confirmPassword: Element | null;
};

declare global {
	var turnstile: TurnstileApi | undefined;
}

let accessToken: string | null = null;
export function getAccessToken(): string | null {
	return accessToken;
}
export function setAccessToken(token: string | null): void {
	accessToken = token && token.length > 0 ? token : null;
}
export function clearAccessToken(): void {
	accessToken = null;
}

const authClient = useAuth();
let portalPreviousFocus: HTMLElement | null = null;
let portalReleaseFocusTrap: (() => void) | null = null;

export function readTurnstileToken(portal: HTMLElement): string {
	const token = portal.querySelector('[data-turnstile-token]');
	if (token instanceof HTMLInputElement && token.value) {
		return token.value;
	}
	if (import.meta.env.PUBLIC_TURNSTILE_SITE_KEY === 'local-dev-turnstile-key' || !import.meta.env.PUBLIC_TURNSTILE_SITE_KEY) {
		return 'local-dev-turnstile-token';
	}
	return '';
}

export function mountTurnstile(portal: HTMLElement): void {
	const container = portal.querySelector('[data-turnstile-slot]');
	if (!(container instanceof HTMLElement)) return;
	const sitekey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;
	if (!sitekey || sitekey === 'local-dev-turnstile-key') {
		const tokenInput = portal.querySelector('[data-turnstile-token]');
		if (tokenInput instanceof HTMLInputElement) {
			tokenInput.value = 'local-dev-turnstile-token';
		}
		return;
	}
	if (typeof globalThis.turnstile === 'undefined') {
		const interval = globalThis.setInterval(() => {
			if (typeof globalThis.turnstile !== 'undefined') {
				globalThis.clearInterval(interval);
				mountTurnstile(portal);
			}
		}, 100);
		return;
	}
	const widgetId = globalThis.turnstile.render(container, {
		sitekey,
		callback: (token: string) => {
			const tokenInput = portal.querySelector('[data-turnstile-token]');
			if (tokenInput instanceof HTMLInputElement) tokenInput.value = token;
		},
		'error-callback': () => notifyWithMascot({ kind: 'error', title: 'Captcha failed', message: 'Could not verify browser. Please try again.' }),
		'expired-callback': () => notifyWithMascot({ kind: 'warning', title: 'Captcha expired', message: 'Verification expired. Please try again.' }),
	});
	container.dataset.turnstileWidgetId = widgetId;
}

export function bindPasswordToggles(root: ParentNode = document): void {
	queryElements('[data-password-toggle]', isButton).forEach((button) => {
		button.addEventListener('click', () => {
			const input = button.closest('.field')?.querySelector('input');
			if (!(input instanceof HTMLInputElement)) return;
			const isPassword = input.type === 'password';
			input.type = isPassword ? 'text' : 'password';
			button.setAttribute('aria-pressed', String(isPassword));
			button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
			button.title = isPassword ? 'Hide password' : 'Show password';
			const icon = button.querySelector('.header-icon--toggle');
			if (icon instanceof HTMLElement) icon.textContent = isPassword ? 'Hide' : 'Show';
		});
	});
}

function readAuthToken(): string | null {
	return getAccessToken();
}

type RpcStatus = {
	ok: boolean;
	status: number;
};

export function isTrustedOsionosRedirect(redirectUrl: string): boolean {
	try {
		const parsed = new URL(redirectUrl, window.location.origin);
		const allowed = [
			window.location.origin,
			import.meta.env.PUBLIC_OSIONOS_APP_URL,
			'https://app.osionos.com',
			'http://localhost:3000',
			'http://localhost:4321',
			'http://localhost:4322',
		].filter(Boolean);
		return allowed.some((origin) => {
			try {
				return new URL(origin).origin === parsed.origin;
			} catch {
				return false;
			}
		});
	} catch {
		return false;
	}
}

async function syncStoredConsents(_token: string, email?: string): Promise<void> {
	const preferences = readConsentPreferences();
	if (preferences?.newsletter && email) {
		await fetch('/api/newsletter/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email }),
		}).catch(() => undefined);
	}
	const newsletterIntent = readStorage(NEWSLETTER_INTENT_KEY);
	if (newsletterIntent && email) {
		await fetch('/api/newsletter/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email }),
		}).catch(() => undefined);
	}
}

function createPortalMarkup(mode: PortalMode): string {
	const quick = mode === 'connect';
	const requiresEmailVerification = authConfig.requireEmailVerification;
	const registerNote = requiresEmailVerification
		? 'Create an account with email verification before opening your workspace.'
		: 'Create a local development account and open your workspace.';
	return `
		<dialog id="portal" class="portal portal--${quick ? 'quick' : 'start'}" aria-labelledby="portal-title">
			<h2 id="portal-title" class="visually-hidden">Prismatica workspace portal</h2>
			<button class="portal__close" type="button" aria-label="Close portal" data-close-portal>×</button>
			<section class="portal__panel portal__panel--login" aria-label="Secure connection panel">
				<div class="portal-login-area">
					<div class="portal-brand portal-brand--auth" aria-hidden="true"><span class="portal-brand__mark">P</span><span>Prismatica</span></div>
					<p class="portal-kicker">${quick ? 'Account connection' : 'Secure account'}</p>
					<h2 aria-hidden="true" data-auth-title>${quick ? 'Open your workspace' : 'Create your workspace'}</h2>
					<p class="portal-note" data-auth-note>${quick ? 'Sign in to connect Prismatica with the osionos app.' : registerNote}</p>
					<div class="portal-auth-switch" role="group" aria-label="Authentication mode">
						<button class="portal-auth-switch__button" type="button" data-auth-switch="register" aria-pressed="${quick ? 'false' : 'true'}">Create account</button>
						<button class="portal-auth-switch__button" type="button" data-auth-switch="login" aria-pressed="${quick ? 'true' : 'false'}">Sign in</button>
					</div>
					<form class="portal-login" novalidate>
						<div class="field-row portal-register-identity">
							<div class="field field--half portal-register-only">
								<label for="portal-username">Username <span aria-hidden="true">*</span></label>
								<input id="portal-username" name="username" type="text" autocomplete="username" placeholder="prism-user" minlength="3" maxlength="32" required />
								<p id="portal-username-inline-error" class="field-validation-message" data-validation-state="idle" aria-live="polite">Choose a unique username.</p>
							</div>
							<div class="field field--half">
								<label for="portal-email">Email <span aria-hidden="true">*</span></label>
								<input id="portal-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
								<p id="portal-email-inline-error" class="field-validation-message" data-validation-state="idle" aria-live="polite">Work or personal email.</p>
							</div>
						</div>
						<div class="field">
							<label for="portal-password">Password <span aria-hidden="true">*</span></label>
							<div class="input-with-button">
								<input id="portal-password" name="password" type="password" autocomplete="current-password" placeholder="••••••••••••" minlength="8" required />
								<button class="button button--ghost button--icon" type="button" data-password-toggle aria-label="Show password">
									<span class="header-icon--toggle" aria-hidden="true">Show</span>
								</button>
							</div>
							<p id="portal-password-inline-error" class="field-validation-message" data-validation-state="idle" aria-live="polite">Min 8 chars with upper, lower, and digit.</p>
							<div class="portal-register-only" data-password-strength-container></div>
						</div>
						<div class="field portal-register-only">
							<label for="portal-confirm-password">Confirm password <span aria-hidden="true">*</span></label>
							<div class="input-with-button">
								<input id="portal-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" placeholder="••••••••••••" minlength="8" required />
								<button class="button button--ghost button--icon" type="button" data-password-toggle aria-label="Show password">
									<span class="header-icon--toggle" aria-hidden="true">Show</span>
								</button>
							</div>
							<p id="portal-confirm-inline-error" class="field-validation-message" data-validation-state="idle" aria-live="polite">Passwords must match.</p>
						</div>
						<div class="field field--checkbox portal-register-only">
							<label class="checkbox-label" for="portal-terms-consent">
								<input id="portal-terms-consent" name="termsConsent" type="checkbox" required />
								<span>I agree to the <a href="/legal/terms/" target="_blank" rel="noopener">Terms</a> and <a href="/legal/privacy-policy/" target="_blank" rel="noopener">Privacy Policy</a> <span aria-hidden="true">*</span></span>
							</label>
						</div>
						<div class="field field--checkbox portal-register-only ${requiresEmailVerification ? '' : 'is-hidden'}">
							<label class="checkbox-label" for="portal-email-verification-consent">
								<input id="portal-email-verification-consent" name="emailVerificationConsent" type="checkbox" ${requiresEmailVerification ? 'checked required' : ''} />
								<span>Send me an email verification link to activate my workspace <span aria-hidden="true">*</span></span>
							</label>
						</div>
						<div class="field field--checkbox portal-register-only">
							<label class="checkbox-label" for="portal-newsletter-consent">
								<input id="portal-newsletter-consent" name="newsletterConsent" type="checkbox" />
								<span>Keep me updated on Prismatica product updates (optional)</span>
							</label>
						</div>
						<div class="portal-turnstile-wrapper" data-turnstile-slot>
							<input type="hidden" name="turnstileToken" data-turnstile-token />
						</div>
						<output class="portal-form-error" aria-live="assertive" role="alert" hidden></output>
						<button class="button button--primary button--full" type="submit" data-auth-submit>
							${quick ? 'Sign in' : 'Create workspace account'}
						</button>
						<div class="portal-alt-actions">
							<button class="portal-link-action" type="button" data-portal-action="forgot-password">
								Forgot password?
							</button>
						</div>
					</form>
				</div>
			</section>
		</dialog>
	`;
}

type PortalFormElements = {
	form: HTMLFormElement;
	username: HTMLInputElement;
	email: HTMLInputElement;
	password: HTMLInputElement;
	confirmPassword: HTMLInputElement | null;
	termsConsent: HTMLInputElement | null;
	emailVerificationConsent: HTMLInputElement | null;
	newsletterConsent: HTMLInputElement | null;
	turnstileToken: HTMLInputElement | null;
	submitButton: HTMLButtonElement | null;
	error: HTMLOutputElement;
};

function portalFormElements(portal: HTMLElement): PortalFormElements | null {
	const form = portal.querySelector('form.portal-login');
	if (!(form instanceof HTMLFormElement)) return null;
	const username = form.elements.namedItem('username');
	const email = form.elements.namedItem('email');
	const password = form.elements.namedItem('password');
	const confirmPassword = form.elements.namedItem('confirmPassword');
	const termsConsent = form.elements.namedItem('termsConsent');
	const emailVerificationConsent = form.elements.namedItem('emailVerificationConsent');
	const newsletterConsent = form.elements.namedItem('newsletterConsent');
	const turnstileToken = form.querySelector('[data-turnstile-token]');
	const submitButton = form.querySelector('button[type="submit"]');
	const error = form.querySelector('.portal-form-error');

	if (!(username instanceof HTMLInputElement) || !(email instanceof HTMLInputElement) || !(password instanceof HTMLInputElement) || !(error instanceof HTMLOutputElement)) {
		return null;
	}
	return {
		form,
		username,
		email,
		password,
		confirmPassword: confirmPassword instanceof HTMLInputElement ? confirmPassword : null,
		termsConsent: termsConsent instanceof HTMLInputElement ? termsConsent : null,
		emailVerificationConsent: emailVerificationConsent instanceof HTMLInputElement ? emailVerificationConsent : null,
		newsletterConsent: newsletterConsent instanceof HTMLInputElement ? newsletterConsent : null,
		turnstileToken: turnstileToken instanceof HTMLInputElement ? turnstileToken : null,
		submitButton: submitButton instanceof HTMLButtonElement ? submitButton : null,
		error,
	};
}

function clearPortalFieldErrors(...fields: (HTMLInputElement | null)[]): void {
	fields.forEach((field) => {
		if (field) {
			field.removeAttribute('aria-invalid');
			field.removeAttribute('aria-describedby');
		}
	});
}

function showPortalFieldError(error: HTMLOutputElement, field: HTMLInputElement, message: string): void {
	error.textContent = message;
	error.removeAttribute('hidden');
	field.setAttribute('aria-invalid', 'true');
	field.focus();
}

function portalRegistrationProfile(elements: PortalFormElements): RegisterProfile {
	return {
		username: elements.username.value.trim(),
		confirmPassword: elements.confirmPassword?.value ?? '',
		emailVerificationConsent: authConfig.requireEmailVerification ? (elements.emailVerificationConsent?.checked ?? true) : Boolean(elements.emailVerificationConsent?.checked),
		newsletterConsent: Boolean(elements.newsletterConsent?.checked),
	};
}

function clearPortalAuthErrors(elements: PortalFormElements): void {
	elements.error.textContent = '';
	elements.error.setAttribute('hidden', '');
	clearPortalFieldErrors(elements.email, elements.password, elements.confirmPassword, elements.username, elements.emailVerificationConsent, elements.termsConsent);
}

function validateRegistrationIdentity(elements: PortalFormElements, isRegister: boolean): boolean {
	const { username, email, error } = elements;
	if (isRegister && (username.value.trim().length < 3 || username.value.trim().length > 32)) {
		showPortalFieldError(error, username, 'Error: Choose a username with 3–32 letters, numbers, dots, underscores, or hyphens.');
		return false;
	}
	if (!email.value.trim() || !validateEmailField(email, 'Please enter your email address')) {
		showPortalFieldError(error, email, 'Please enter a valid email address (e.g. you@example.com)');
		return false;
	}
	return true;
}

function validatePortalPasswordFields(elements: PortalFormElements, isRegister: boolean): boolean {
	const { password, confirmPassword, error } = elements;
	if (isRegister) {
		const checks = passwordRuleResults(password.value);
		if (!checks.every((c) => c.passed)) {
			showPortalFieldError(error, password, 'Error: Your password does not meet the security requirements.');
			return false;
		}
		if (confirmPassword && password.value !== confirmPassword.value) {
			showPortalFieldError(error, confirmPassword, 'Error: Repeat the same password.');
			return false;
		}
	} else if (!password.value) {
		showPortalFieldError(error, password, 'Error: Enter your password.');
		return false;
	}
	return true;
}

function validatePortalProfileFields(elements: PortalFormElements, isRegister: boolean): boolean {
	const { emailVerificationConsent, error, termsConsent } = elements;
	if (isRegister && termsConsent && !termsConsent.checked) {
		showPortalFieldError(error, termsConsent, 'Error: Accept the Terms of Service and Privacy Policy to create an account.');
		return false;
	}
	if (authConfig.requireEmailVerification && isRegister && emailVerificationConsent && !emailVerificationConsent.checked) {
		showPortalFieldError(error, emailVerificationConsent, 'Error: Email verification must stay enabled for account security.');
		return false;
	}
	return true;
}

function humanAuthMessage(message: string): string {
	const trimmed = message.trim();
	if (!trimmed) return 'Please check the form and try again.';
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		try {
			const parsed = JSON.parse(trimmed) as { message?: string; error?: string };
			return parsed.message ?? parsed.error ?? 'Authentication failed.';
		} catch {
			return trimmed;
		}
	}
	return trimmed;
}

function messageMentions(message: string, ...keywords: string[]): boolean {
	const lower = message.toLowerCase();
	return keywords.some((k) => lower.includes(k.toLowerCase()));
}

export function emailValidationResult(field: HTMLInputElement): { valid: boolean; message: string } {
	const val = field.value.trim();
	if (!val) return { valid: false, message: 'Please enter your email address' };
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(val)) return { valid: false, message: 'Please enter a valid email address (e.g. you@example.com)' };
	return { valid: true, message: 'Looks good!' };
}

export function hasValidEmailFormat(field: HTMLInputElement): boolean {
	return emailValidationResult(field).valid;
}

function describedByValues(field: HTMLInputElement): string[] {
	return (field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
}

function ensureInlineFieldMessage(field: HTMLInputElement, messageId: string): HTMLElement {
	let message = document.getElementById(messageId);
	if (!message) {
		message = document.createElement('p');
		message.id = messageId;
		message.className = 'field-validation-message';
		message.setAttribute('aria-live', 'polite');
		field.parentElement?.appendChild(message);
	}
	return message;
}

function showInlineFieldMessage(field: HTMLInputElement, messageId: string, text: string, state: 'idle' | 'checking' | 'valid' | 'invalid'): void {
	const message = ensureInlineFieldMessage(field, messageId);
	message.textContent = text;
	message.dataset.validationState = state;
	const ids = new Set(describedByValues(field));
	ids.add(messageId);
	field.setAttribute('aria-describedby', Array.from(ids).join(' '));
}

function showInlineFieldError(field: HTMLInputElement, messageId: string, text: string): void {
	field.setAttribute('aria-invalid', 'true');
	showInlineFieldMessage(field, messageId, text, 'invalid');
}

function clearInlineFieldError(field: HTMLInputElement, messageId: string, idleText = ''): void {
	field.removeAttribute('aria-invalid');
	const message = document.getElementById(messageId);
	if (!message) return;
	if (idleText) {
		message.textContent = idleText;
		message.dataset.validationState = 'idle';
	} else {
		message.textContent = '';
		message.dataset.validationState = 'idle';
		const ids = describedByValues(field).filter((id) => id !== messageId);
		if (ids.length > 0) field.setAttribute('aria-describedby', ids.join(' '));
		else field.removeAttribute('aria-describedby');
	}
}

export function validateEmailField(field: HTMLInputElement, emptyMessage = 'Please enter your email address'): boolean {
	const messageId = `${field.id || 'field'}-inline-error`;
	const result = emailValidationResult(field);
	if (!field.value.trim()) {
		showInlineFieldError(field, messageId, emptyMessage);
		return false;
	}
	if (!result.valid) {
		showInlineFieldError(field, messageId, result.message);
		return false;
	}
	clearInlineFieldError(field, messageId, 'Looks good!');
	return true;
}

function updateEmailFieldFeedback(field: HTMLInputElement): boolean {
	if (!field.value.trim()) {
		clearInlineFieldError(field, `${field.id || 'field'}-inline-error`, 'Work or personal email.');
		return false;
	}
	return validateEmailField(field);
}

function usernameValidationState(field: HTMLInputElement): { valid: boolean; message: string } {
	const val = field.value.trim();
	if (!val) return { valid: false, message: 'Choose a unique username.' };
	if (val.length < 3 || val.length > 32) return { valid: false, message: 'Username must be 3–32 characters.' };
	if (!/^[a-zA-Z0-9_.-]+$/.test(val)) return { valid: false, message: 'Only letters, numbers, dots, hyphens, and underscores.' };
	return { valid: true, message: 'Username looks good.' };
}

function setPortalAvailabilityState(portal: HTMLElement, field: 'email' | 'username', state: 'unknown' | 'checking' | 'available' | 'taken'): void {
	portal.dataset[`${field}Availability`] = state;
}

function showAvailabilityResult(field: HTMLInputElement, available: boolean, takenMessage: string, availableMessage: string): void {
	const messageId = `${field.id || 'field'}-inline-error`;
	if (available) {
		clearInlineFieldError(field, messageId, availableMessage);
		const message = document.getElementById(messageId);
		if (message) message.dataset.validationState = 'valid';
	} else {
		showInlineFieldError(field, messageId, takenMessage);
	}
}

function availabilityStateAllowsSubmit(portal: HTMLElement): boolean {
	return portal.dataset.emailAvailability !== 'taken' && portal.dataset.usernameAvailability !== 'taken';
}

export function bindEmailFieldValidation(scope: ParentNode = document): void {
	queryElements('input[type="email"]', isInput).forEach((input) => {
		input.addEventListener('blur', () => updateEmailFieldFeedback(input));
		input.addEventListener('input', () => {
			if (input.getAttribute('aria-invalid') === 'true') updateEmailFieldFeedback(input);
		});
	});
}

function renderPasswordStrength(root: ParentNode): void {
	const container = root.querySelector('[data-password-strength-container]');
	if (!container) return;
	const input = root.querySelector('#portal-password');
	if (!(input instanceof HTMLInputElement)) return;
	const strength = checkPasswordStrength(input.value);
	// DOM nodes, not markup: the CSP requires Trusted Types, so a string assigned to
	// innerHTML throws, and its style-src refuses a style="" attribute. CSSOM is allowed.
	const meter = document.createElement('div');
	meter.className = 'password-meter';
	meter.dataset.score = String(strength.score);
	const bar = document.createElement('div');
	bar.className = 'password-meter__bar';
	bar.style.width = `${(strength.score / 4) * 100}%`;
	meter.append(bar);
	const label = document.createElement('span');
	label.className = 'password-meter__label';
	label.textContent = strength.level || 'Enter a strong password';
	container.replaceChildren(meter, label);
}

function syncPasswordMatchStatus(match: boolean, confirmPassword: HTMLInputElement | null): void {
	if (!confirmPassword) return;
	const messageId = `${confirmPassword.id}-inline-error`;
	if (confirmPassword.value.length === 0) {
		clearInlineFieldError(confirmPassword, messageId, 'Passwords must match.');
		return;
	}
	if (match) {
		clearInlineFieldError(confirmPassword, messageId, 'Passwords match.');
		const msg = document.getElementById(messageId);
		if (msg) msg.dataset.validationState = 'valid';
	} else {
		showInlineFieldError(confirmPassword, messageId, 'Passwords do not match.');
	}
}

function syncPortalPasswordFeedback(portal: HTMLElement, elements: PortalFormElements): boolean {
	const isRegister = portal.dataset.authMode === 'register';
	if (!isRegister) return elements.password.value.length > 0;
	renderPasswordStrength(portal);
	const strength = checkPasswordStrength(elements.password.value);
	const match = Boolean(elements.confirmPassword && elements.password.value === elements.confirmPassword.value);
	syncPasswordMatchStatus(match, elements.confirmPassword);
	return strength.score >= 2 && match;
}

function updatePortalSubmitAvailability(portal: HTMLElement, elements: PortalFormElements): void {
	const isRegister = portal.dataset.authMode === 'register';
	const passwordReady = syncPortalPasswordFeedback(portal, elements);
	const termsReady = !(elements.termsConsent instanceof HTMLInputElement) || elements.termsConsent.checked;
	const verificationReady = !authConfig.requireEmailVerification || !(elements.emailVerificationConsent instanceof HTMLInputElement) || elements.emailVerificationConsent.checked;
	const emailReady = hasValidEmailFormat(elements.email);
	const usernameReady = !isRegister || usernameValidationState(elements.username).valid;
	const availabilityReady = !isRegister || availabilityStateAllowsSubmit(portal);

	const canSubmit = isRegister
		? passwordReady && termsReady && verificationReady && emailReady && usernameReady && availabilityReady
		: elements.email.value.trim().length > 0 && elements.password.value.length > 0;

	if (elements.submitButton) {
		elements.submitButton.disabled = !canSubmit;
	}
}

async function submitPortalRecovery(portal: HTMLElement, elements: PortalFormElements): Promise<void> {
	const email = elements.email;
	clearPortalFieldErrors(email);
	if (!validateEmailField(email, 'Please enter your email address')) {
		showPortalFieldError(elements.error, email, 'Please enter a valid email address (e.g. you@example.com)');
		return;
	}
	setPortalSubmitBusy(elements.submitButton, true, false);
	try {
		await authClient.recover({ email: email.value.trim(), turnstileToken: readTurnstileToken(portal) });
		elements.error.textContent = 'Password reset instructions have been sent to your email address.';
		elements.error.removeAttribute('hidden');
		notifyWithMascot({ kind: 'success', title: 'Reset link sent', message: 'Check your email inbox.' });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not request password recovery.';
		elements.error.textContent = humanAuthMessage(message);
		elements.error.removeAttribute('hidden');
		notifyWithMascot({ kind: 'error', title: 'Recovery failed', message: elements.error.textContent });
	} finally {
		setPortalSubmitBusy(elements.submitButton, false, false);
	}
}

function validateRegistrationAvailability(portal: HTMLElement, elements: PortalFormElements, isRegister: boolean): boolean {
	if (!isRegister) return true;
	if (portal.dataset.usernameAvailability === 'taken') {
		showPortalFieldError(elements.error, elements.username, 'Error: This username is already taken.');
		return false;
	}
	if (portal.dataset.emailAvailability === 'taken') {
		showPortalFieldError(elements.error, elements.email, 'Error: This email is already registered.');
		return false;
	}
	return true;
}

export function validatePortalAuth(portal: HTMLElement, elements: PortalFormElements, isRegister: boolean): string | null {
	clearPortalAuthErrors(elements);
	if (!validateRegistrationIdentity(elements, isRegister) || !validatePortalPasswordFields(elements, isRegister) || !validatePortalProfileFields(elements, isRegister)) {
		return null;
	}
	if (!validateRegistrationAvailability(portal, elements, isRegister)) {
		return null;
	}
	const turnstileToken = readTurnstileToken(portal);
	if (!turnstileToken) {
		elements.error.textContent = 'Please complete the verification check before submitting.';
		elements.error.removeAttribute('hidden');
		return null;
	}
	return turnstileToken;
}

function setPortalSubmitBusy(button: HTMLButtonElement | null, busy: boolean, isRegister: boolean): void {
	if (!button) return;
	button.disabled = busy;
	button.textContent = busy ? 'Please wait…' : isRegister ? 'Create workspace account' : 'Sign in';
}

async function processPortalRegistration(elements: PortalFormElements, turnstileToken: string): Promise<void> {
	const result = await authClient.register({ email: elements.email.value.trim(), password: elements.password.value, turnstileToken, profile: portalRegistrationProfile(elements) });
	const message = humanAuthMessage(result.message);
	if (result.ok) {
		if (result.accessToken) {
			setAccessToken(result.accessToken);
			await syncStoredConsents(result.accessToken, elements.email.value.trim());
		}
		notifyWithMascot({
			kind: 'success',
			title: 'Welcome to Prismatica!',
			message: authConfig.requireEmailVerification
				? 'Your workspace account has been created. Check your inbox for the verification link.'
				: 'Your local workspace account is ready.',
			duration: 6000,
		});
		setMountedMascotMood('excited', 2000);
		announce(authConfig.requireEmailVerification ? 'Account created. Check your email before signing in.' : 'Development account created. You can sign in now.');
		globalThis.setTimeout(() => closePortal(), 1500);
		return;
	}
	if (result.status === 429) {
		notifyWithMascot({
			kind: 'warning',
			title: 'Too many attempts',
			message: 'You have been temporarily blocked. Please wait a few minutes.',
			duration: 9000,
		});
		return;
	}
	if (result.status === 422 && messageMentions(message, 'user already registered', 'already registered', 'already exists')) {
		notifyWithMascot({
			kind: 'info',
			title: 'Account already exists',
			message: 'An account with this email already exists. Try signing in instead.',
			duration: 6000,
		});
		return;
	}
	if (result.status === 409 || messageMentions(message, 'already registered', 'already taken', 'unique')) {
		notifyWithMascot({
			kind: 'warning',
			title: 'Choose another identity',
			message,
			duration: 7000,
		});
		return;
	}
	notifyWithMascot({
		kind: 'error',
		title: 'Registration failed',
		message,
		duration: 8000,
	});
	announce('Registration failed. Check the form and try again.');
}

async function processPortalLogin(elements: PortalFormElements, turnstileToken: string): Promise<void> {
	const authenticated = await authClient.signIn({ email: elements.email.value.trim(), password: elements.password.value, turnstileToken });
	const message = humanAuthMessage(authenticated.message);
	if (!authenticated.ok) {
		if (authenticated.status === 429) {
			console.warn(`[portal] sign-in refused: HTTP 429 — ${message}`);
			notifyWithMascot({
				kind: 'warning',
				title: 'Too many attempts',
				message: 'You have been temporarily blocked. Please wait a few minutes.',
				duration: 9000,
			});
			return;
		}
		if (messageMentions(message, 'email not confirmed', 'not confirmed', 'confirm your email')) {
			notifyWithMascot({
				kind: 'warning',
				title: 'Email not confirmed',
				message: 'Please check your inbox and click the confirmation link first.',
				duration: 9000,
			});
			return;
		}
		if (authenticated.status === 422 || authenticated.status === 400 || authenticated.status === 401) {
			console.warn(authenticated.status === 401
				? `[portal] sign-in refused: the auth service checked the password for ${elements.email.value.trim()} and rejected it (HTTP 401)`
				: `[portal] sign-in refused before the password was checked: HTTP ${authenticated.status} — ${message}`);
			notifyWithMascot({
				kind: 'error',
				title: 'Incorrect email or password',
				message: 'Double-check your credentials and try again.',
				duration: 8000,
			});
			setMountedMascotMood('scared', 1200);
			announce('Incorrect email or password.');
			return;
		}
		console.error(`[portal] sign-in failed before the password was checked: HTTP ${authenticated.status} — ${message}`);
		notifyWithMascot({
			kind: 'error',
			title: 'Connection failed',
			message,
			duration: 8000,
		});
		return;
	}
	if (authenticated.accessToken) {
		setAccessToken(authenticated.accessToken);
		await syncStoredConsents(authenticated.accessToken, elements.email.value.trim());
	}
	const osionosBridge = authenticated.accessToken
		? await authClient.osionosSession(authenticated.accessToken).catch(() => null)
		: null;
	if (osionosBridge?.ok && osionosBridge.redirectUrl) {
		const redirectUrl = osionosBridge.redirectUrl;
		if (!isTrustedOsionosRedirect(redirectUrl)) {
			console.error('Blocked osionos redirect to untrusted origin:', redirectUrl);
			notifyWithMascot({
				kind: 'error',
				title: 'Workspace redirect blocked',
				message: 'The osionos workspace link did not match the expected app origin.',
				duration: 8000,
			});
			announce('Workspace redirect blocked for safety.');
			return;
		}
		notifyWithMascot({
			kind: 'success',
			title: 'Opening osionos',
			message: 'Your private osionos workspace is ready.',
			duration: 2500,
		});
		setMountedMascotMood('happy', 1800);
		announce('Opening your osionos workspace.');
		globalThis.setTimeout(() => {
			globalThis.location.assign(redirectUrl);
		}, 700);
		return;
	}
	notifyWithMascot({ kind: 'success', title: 'Signed in successfully', message: 'Opening your workspace…' });
	globalThis.setTimeout(() => closePortal(), 1200);
}

async function submitPortalLogin(portal: HTMLElement, elements: PortalFormElements): Promise<void> {
	const isRegister = portal.dataset.authMode === 'register';
	const turnstileToken = validatePortalAuth(portal, elements, isRegister);
	if (!turnstileToken) return;
	setPortalSubmitBusy(elements.submitButton, true, isRegister);
	try {
		if (isRegister) await processPortalRegistration(elements, turnstileToken);
		else await processPortalLogin(elements, turnstileToken);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Authentication failed.';
		elements.error.textContent = humanAuthMessage(message);
		elements.error.removeAttribute('hidden');
		notifyWithMascot({ kind: 'error', title: 'Authentication error', message: elements.error.textContent });
	} finally {
		setPortalSubmitBusy(elements.submitButton, false, portal.dataset.authMode === 'register');
	}
}

function syncAuthModeCopy(controls: AuthModeControls, mode: 'login' | 'register'): void {
	const isRegister = mode === 'register';
	if (controls.title) controls.title.textContent = isRegister ? 'Create your workspace' : 'Open your workspace';
	if (controls.note) {
		controls.note.textContent = isRegister
			? authConfig.requireEmailVerification
				? 'Create an account with email verification before opening your workspace.'
				: 'Create a local development account and open your workspace.'
			: 'Sign in to connect Prismatica with the osionos app.';
	}
	if (controls.submitBtn) controls.submitBtn.textContent = isRegister ? 'Create workspace account' : 'Sign in';
	controls.registerBtn?.setAttribute('aria-pressed', String(isRegister));
	controls.loginBtn?.setAttribute('aria-pressed', String(!isRegister));
}

function syncAuthModeVisibility(portal: HTMLElement, mode: 'login' | 'register'): void {
	const isRegister = mode === 'register';
	portal.dataset.authMode = mode;
	portal.querySelectorAll('.portal-register-only').forEach((el) => {
		if (el instanceof HTMLElement) {
			if (el.classList.contains('portal-register-identity')) {
				el.classList.toggle('field-row--single', !isRegister);
			} else {
				el.hidden = !isRegister;
			}
		}
	});
}

function syncAuthModeInputs(controls: AuthModeControls, mode: 'login' | 'register'): void {
	const isRegister = mode === 'register';
	if (controls.username instanceof HTMLInputElement) controls.username.required = isRegister;
	if (controls.confirmPassword instanceof HTMLInputElement) controls.confirmPassword.required = isRegister;
	if (controls.termsConsent instanceof HTMLInputElement) controls.termsConsent.required = isRegister;
}

export function closePortal(): void {
	const portal = queryElement('.portal', isHtmlElement);
	if (!portal) return;
	portalReleaseFocusTrap?.();
	portalReleaseFocusTrap = null;
	if (portal instanceof HTMLDialogElement && portal.open) {
		portal.close();
	}
	portal.classList.remove('is-revealed');
	document.body.classList.remove('portal-open');
	portalPreviousFocus?.focus({ preventScroll: true });
	portalPreviousFocus = null;
}

export function openPortal(mode: PortalMode): void {
	closePortal();
	portalPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	insertTrustedHTML(document.body, 'beforeend', createPortalMarkup(mode));
	const portal = queryElement('.portal', isHtmlElement);
	if (!portal) return;

	bindPasswordToggles(portal);
	ensureButtonLabels();
	document.body.classList.add('portal-open');
	announce('Workspace portal opened');
	requestAnimationFrame(() => portal.classList.add('is-revealed'));
	portal.querySelector('[data-close-portal]')?.addEventListener('click', closePortal);

	if (portal instanceof HTMLDialogElement) {
		portal.addEventListener('close', () => {
			document.body.classList.remove('portal-open');
			portalPreviousFocus?.focus({ preventScroll: true });
			portalPreviousFocus = null;
		}, { once: true });
		portal.addEventListener('click', (event) => {
			if (event.target === portal) portal.close();
		});
		try {
			portal.showModal();
		} catch {
			// Already open or not connected; nothing to do.
		}
	}

	mountTurnstile(portal);
	const elements = portalFormElements(portal);
	if (!elements) return;

	const refreshPortalValidation = (): void => {
		updatePortalSubmitAvailability(portal, elements);
	};

	const applyAuthMode = (targetMode: 'login' | 'register'): void => {
		syncAuthModeVisibility(portal, targetMode);
		syncAuthModeCopy({
			title: portal.querySelector('[data-auth-title]'),
			note: portal.querySelector('[data-auth-note]'),
			registerBtn: portal.querySelector('[data-auth-switch="register"]'),
			loginBtn: portal.querySelector('[data-auth-switch="login"]'),
			submitBtn: elements.submitButton,
			usernameWrap: null,
			confirmPasswordWrap: null,
			termsConsent: null,
			emailVerification: null,
			email: elements.email,
			username: elements.username,
			emailVerificationConsent: elements.emailVerificationConsent,
			password: elements.password,
			confirmPassword: elements.confirmPassword,
		}, targetMode);
		syncAuthModeInputs({
			title: null, note: null, registerBtn: null, loginBtn: null, submitBtn: null,
			usernameWrap: null, confirmPasswordWrap: null, termsConsent: elements.termsConsent, emailVerification: null,
			email: elements.email, username: elements.username, emailVerificationConsent: elements.emailVerificationConsent,
			password: elements.password, confirmPassword: elements.confirmPassword,
		}, targetMode);
		clearPortalAuthErrors(elements);
		refreshPortalValidation();
	};

	portal.querySelectorAll('[data-auth-switch]').forEach((btn) => {
		btn.addEventListener('click', () => {
			applyAuthMode(btn.getAttribute('data-auth-switch') === 'register' ? 'register' : 'login');
		});
	});

	elements.form.addEventListener('submit', (event) => {
		event.preventDefault();
		void (portal.dataset.portalMode === 'recovery' ? submitPortalRecovery(portal, elements) : submitPortalLogin(portal, elements));
	});

	[elements.email, elements.password, elements.username, elements.confirmPassword].forEach((f) => {
		if (f) f.addEventListener('input', refreshPortalValidation);
	});
	[elements.termsConsent, elements.emailVerificationConsent].forEach((c) => {
		if (c) c.addEventListener('change', refreshPortalValidation);
	});

	applyAuthMode(mode === 'connect' ? 'login' : 'register');
	elements.email.focus();
}