import { authConfig } from '../lib/auth-config';
import { type RegisterProfile } from '../hooks/useAuth';
import { passwordRuleResults } from '../lib/auth-validation';
import { isInput } from '../lib/dom-utils';
import { syncPortalPasswordFeedback } from './portal-strength';

export const LOCAL_TURNSTILE_TOKEN = 'localhost-turnstile-token';

export type PortalFormElements = {
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
	resendVerification: HTMLButtonElement | null;
};

export function readTurnstileToken(portal: HTMLElement): string {
	const token = portal.querySelector('[data-turnstile-token]');
	if (token instanceof HTMLInputElement && token.value) {
		return token.value;
	}
	return authConfig.turnstileSiteKey ? '' : LOCAL_TURNSTILE_TOKEN;
}

export function portalFormElements(portal: HTMLElement): PortalFormElements | null {
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
	const resendVerification = form.querySelector('[data-resend-verification]');

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
		resendVerification: resendVerification instanceof HTMLButtonElement ? resendVerification : null,
	};
}

export function clearPortalFieldErrors(...fields: (HTMLInputElement | null)[]): void {
	fields.forEach((field) => {
		if (field) {
			field.removeAttribute('aria-invalid');
			field.removeAttribute('aria-describedby');
		}
	});
}

export function showPortalFieldError(error: HTMLOutputElement, field: HTMLInputElement, message: string): void {
	error.textContent = message;
	error.removeAttribute('hidden');
	field.setAttribute('aria-invalid', 'true');
	field.focus();
}

export function portalRegistrationProfile(elements: PortalFormElements): RegisterProfile {
	return {
		username: elements.username.value.trim(),
		confirmPassword: elements.confirmPassword?.value ?? '',
		emailVerificationConsent: authConfig.requireEmailVerification ? (elements.emailVerificationConsent?.checked ?? true) : Boolean(elements.emailVerificationConsent?.checked),
		newsletterConsent: Boolean(elements.newsletterConsent?.checked),
	};
}

export function clearPortalAuthErrors(elements: PortalFormElements): void {
	elements.error.textContent = '';
	elements.error.setAttribute('hidden', '');
	elements.resendVerification?.setAttribute('hidden', '');
	clearPortalFieldErrors(elements.email, elements.password, elements.confirmPassword, elements.username, elements.emailVerificationConsent, elements.termsConsent);
}

export function validateRegistrationIdentity(elements: PortalFormElements, isRegister: boolean): boolean {
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

export function validatePortalPasswordFields(elements: PortalFormElements, isRegister: boolean): boolean {
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

export function validatePortalProfileFields(elements: PortalFormElements, isRegister: boolean): boolean {
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

export function showInlineFieldMessage(field: HTMLInputElement, messageId: string, text: string, state: 'idle' | 'checking' | 'valid' | 'invalid'): void {
	const message = ensureInlineFieldMessage(field, messageId);
	message.textContent = text;
	message.dataset.validationState = state;
	const ids = new Set(describedByValues(field));
	ids.add(messageId);
	field.setAttribute('aria-describedby', Array.from(ids).join(' '));
}

export function showInlineFieldError(field: HTMLInputElement, messageId: string, text: string): void {
	field.setAttribute('aria-invalid', 'true');
	showInlineFieldMessage(field, messageId, text, 'invalid');
}

export function clearInlineFieldError(field: HTMLInputElement, messageId: string, idleText = ''): void {
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

export function usernameValidationState(field: HTMLInputElement): { valid: boolean; message: string } {
	const val = field.value.trim();
	if (!val) return { valid: false, message: 'Choose a unique username.' };
	if (val.length < 3 || val.length > 32) return { valid: false, message: 'Username must be 3–32 characters.' };
	if (!/^[a-zA-Z0-9_.-]+$/.test(val)) return { valid: false, message: 'Only letters, numbers, dots, hyphens, and underscores.' };
	return { valid: true, message: 'Username looks good.' };
}

function availabilityStateAllowsSubmit(portal: HTMLElement): boolean {
	return portal.dataset.emailAvailability !== 'taken' && portal.dataset.usernameAvailability !== 'taken';
}

export function bindEmailFieldValidation(scope: ParentNode = document): void {
	Array.from(scope.querySelectorAll('input[type="email"]')).filter(isInput).forEach((input) => {
		input.addEventListener('blur', () => updateEmailFieldFeedback(input));
		input.addEventListener('input', () => {
			if (input.getAttribute('aria-invalid') === 'true') updateEmailFieldFeedback(input);
		});
	});
}

export function updatePortalSubmitAvailability(portal: HTMLElement, elements: PortalFormElements): void {
	if (portal.dataset.portalMode === 'recovery') {
		if (elements.submitButton) elements.submitButton.disabled = elements.email.value.trim().length === 0;
		return;
	}
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

export function validateRegistrationAvailability(portal: HTMLElement, elements: PortalFormElements, isRegister: boolean): boolean {
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