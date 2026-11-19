import { describe, expect, it } from 'vitest';
import {
	LOCAL_TURNSTILE_TOKEN,
	readTurnstileToken,
	portalFormElements,
	clearPortalFieldErrors,
	showPortalFieldError,
	portalRegistrationProfile,
	clearPortalAuthErrors,
	emailValidationResult,
	hasValidEmailFormat,
	usernameValidationState,
	validateEmailField,
	validateRegistrationAvailability,
	validatePortalPasswordFields,
	validatePortalProfileFields,
	validateRegistrationIdentity,
	validatePortalAuth,
} from '../../../src/scripts/portal-validation';

describe('portal-validation module', () => {
	it('reads turnstile token correctly from DOM or fallback', () => {
		const container = document.createElement('div');
		expect(readTurnstileToken(container)).toBe(LOCAL_TURNSTILE_TOKEN);

		const input = document.createElement('input');
		input.setAttribute('data-turnstile-token', '');
		input.value = 'cf-custom-token-xyz';
		container.appendChild(input);
		expect(readTurnstileToken(container)).toBe('cf-custom-token-xyz');
	});

	it('validates email format and messages', () => {
		const input = document.createElement('input');
		input.value = '';
		expect(emailValidationResult(input).valid).toBe(false);
		expect(hasValidEmailFormat(input)).toBe(false);

		input.value = 'not-an-email';
		expect(emailValidationResult(input).valid).toBe(false);
		expect(hasValidEmailFormat(input)).toBe(false);

		input.value = 'valid.user@prismatica.io';
		expect(emailValidationResult(input).valid).toBe(true);
		expect(hasValidEmailFormat(input)).toBe(true);
		expect(emailValidationResult(input).message).toBe('Looks good!');
	});

	it('validates username format and length bounds', () => {
		const input = document.createElement('input');
		input.value = '';
		expect(usernameValidationState(input).valid).toBe(false);

		input.value = 'ab';
		expect(usernameValidationState(input).valid).toBe(false);
		expect(usernameValidationState(input).message).toContain('3–32 characters');

		input.value = 'a'.repeat(33);
		expect(usernameValidationState(input).valid).toBe(false);

		input.value = 'user@invalid!';
		expect(usernameValidationState(input).valid).toBe(false);

		input.value = 'valid_user.name-42';
		expect(usernameValidationState(input).valid).toBe(true);
	});

	it('handles inline error messages and field states', () => {
		const parent = document.createElement('div');
		const input = document.createElement('input');
		input.id = 'test-input';
		parent.appendChild(input);

		input.value = '';
		expect(validateEmailField(input)).toBe(false);
		expect(input.getAttribute('aria-invalid')).toBe('true');

		input.value = 'hello@world.com';
		expect(validateEmailField(input)).toBe(true);
		expect(input.getAttribute('aria-invalid')).toBeNull();
	});

	it('clears and shows field-level portal errors', () => {
		const error = document.createElement('output');
		const field = document.createElement('input');

		showPortalFieldError(error, field, 'Sample error message');
		expect(error.textContent).toBe('Sample error message');
		expect(error.hidden).toBe(false);
		expect(field.getAttribute('aria-invalid')).toBe('true');

		clearPortalFieldErrors(field, null);
		expect(field.getAttribute('aria-invalid')).toBeNull();
	});

	it('validates portalFormElements query helper', () => {
		const wrapper = document.createElement('div');
		expect(portalFormElements(wrapper)).toBeNull();

		wrapper.innerHTML = `
			<form class="portal-login">
				<input name="username" />
				<input name="email" />
				<input name="password" />
				<output class="portal-form-error"></output>
			</form>
		`;
		const elements = portalFormElements(wrapper);
		expect(elements).not.toBeNull();
		expect(elements?.username.name).toBe('username');
		expect(elements?.email.name).toBe('email');
		expect(elements?.password.name).toBe('password');
		expect(elements?.confirmPassword).toBeNull();
	});

	it('builds registration profile from form elements', () => {
		const form = document.createElement('form');
		const username = document.createElement('input');
		username.value = '  alice  ';
		const email = document.createElement('input');
		email.value = 'alice@example.com';
		const password = document.createElement('input');
		password.value = 'secret';
		const confirmPassword = document.createElement('input');
		confirmPassword.value = 'secret';
		const newsletter = document.createElement('input');
		newsletter.type = 'checkbox';
		newsletter.checked = true;
		const error = document.createElement('output');

		const elements = {
			form,
			username,
			email,
			password,
			confirmPassword,
			termsConsent: null,
			emailVerificationConsent: null,
			newsletterConsent: newsletter,
			turnstileToken: null,
			submitButton: null,
			error,
			resendVerification: null,
		};

		const profile = portalRegistrationProfile(elements);
		expect(profile.username).toBe('alice');
		expect(profile.confirmPassword).toBe('secret');
		expect(profile.newsletterConsent).toBe(true);

		clearPortalAuthErrors(elements);
		expect(error.textContent).toBe('');
		expect(error.hasAttribute('hidden')).toBe(true);
	});

	it('validates identity, password, profile, availability and overall auth', () => {
		const portal = document.createElement('div');
		const form = document.createElement('form');
		const username = document.createElement('input');
		const email = document.createElement('input');
		const password = document.createElement('input');
		const confirmPassword = document.createElement('input');
		const terms = document.createElement('input');
		terms.type = 'checkbox';
		const error = document.createElement('output');

		const elements = {
			form,
			username,
			email,
			password,
			confirmPassword,
			termsConsent: terms,
			emailVerificationConsent: null,
			newsletterConsent: null,
			turnstileToken: null,
			submitButton: null,
			error,
			resendVerification: null,
		};

		// Registration identity validation
		username.value = 'al';
		email.value = 'al@domain.com';
		expect(validateRegistrationIdentity(elements, true)).toBe(false);
		username.value = 'alice123';
		expect(validateRegistrationIdentity(elements, true)).toBe(true);

		// Registration password validation
		password.value = 'weak';
		confirmPassword.value = 'weak';
		expect(validatePortalPasswordFields(elements, true)).toBe(false);
		password.value = 'SecureP@ssw0rd99';
		confirmPassword.value = 'MismatchP@ssw0rd99';
		expect(validatePortalPasswordFields(elements, true)).toBe(false);
		confirmPassword.value = 'SecureP@ssw0rd99';
		expect(validatePortalPasswordFields(elements, true)).toBe(true);

		// Terms consent validation
		terms.checked = false;
		expect(validatePortalProfileFields(elements, true)).toBe(false);
		terms.checked = true;
		expect(validatePortalProfileFields(elements, true)).toBe(true);

		// Availability check
		portal.dataset.usernameAvailability = 'taken';
		expect(validateRegistrationAvailability(portal, elements, true)).toBe(false);
		delete portal.dataset.usernameAvailability;
		expect(validateRegistrationAvailability(portal, elements, true)).toBe(true);

		// validatePortalAuth comprehensive
		const token = validatePortalAuth(portal, elements, true);
		expect(token).toBe(LOCAL_TURNSTILE_TOKEN);
	});
});