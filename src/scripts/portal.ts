import { insertTrustedHTML, queryElement, isHtmlElement } from '../lib/dom-utils';
import { authConfig } from '../lib/auth-config';
import { announce, ensureButtonLabels } from './theme';
import { bindLoginCodeStep } from './portal-login-code';
import { bindLoginApproveStep } from './portal-login-approve';
import { createPortalMarkup } from './portal-markup';
import { bindPortalOAuth } from './portal-oauth';
import { mountTurnstile } from './portal-turnstile';
import {
	authClient,
	submitPortalLogin,
	submitPortalRecovery,
	submitPortalResendVerification,
	completePortalLogin,
	RECOVERY_SUBMIT_LABEL,
} from './portal-auth-flow';
import {
	portalFormElements,
	clearPortalAuthErrors,
	updatePortalSubmitAvailability,
} from './portal-validation';

export type PortalMode = 'start' | 'connect';

type AuthModeControls = {
	title: HTMLElement | null;
	note: HTMLElement | null;
	registerBtn: HTMLElement | null;
	loginBtn: HTMLElement | null;
	submitBtn: HTMLButtonElement | null;
	usernameWrap: HTMLElement | null;
	confirmPasswordWrap: HTMLElement | null;
	termsConsent: HTMLInputElement | null;
	emailVerification: HTMLElement | null;
	email: HTMLInputElement;
	username: HTMLInputElement;
	emailVerificationConsent: HTMLInputElement | null;
	password: HTMLInputElement;
	confirmPassword: HTMLInputElement | null;
};

let portalPreviousFocus: HTMLElement | null = null;
let portalReleaseFocusTrap: (() => void) | null = null;

export function bindPasswordToggles(root: ParentNode = document): void {
	const toggles = root.querySelectorAll('[data-password-toggle]');
	for (let i = 0; i < toggles.length; i++) {
		const button = toggles[i];
		if (!(button instanceof HTMLButtonElement)) continue;
		button.addEventListener('click', () => {
			const input = button.closest('.field')?.querySelector('input');
			if (!(input instanceof HTMLInputElement)) return;
			const isPassword = input.type === 'password';
			input.type = isPassword ? 'text' : 'password';
			button.setAttribute('aria-pressed', String(isPassword));
			button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
			button.title = isPassword ? 'Hide password' : 'Show password';
			const icon = button.querySelector('.portal-toggle-text');
			if (icon instanceof HTMLElement) icon.textContent = isPassword ? 'Hide' : 'Show';
		});
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
	document.querySelectorAll('.portal').forEach((stale) => stale.remove());
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
			if (!portal.isConnected) return;
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

	const passwordField = elements.password.closest('.field');
	const setRecovery = (on: boolean): void => {
		if (on) portal.dataset.portalMode = 'recovery';
		else delete portal.dataset.portalMode;
		if (passwordField instanceof HTMLElement) passwordField.hidden = on;
		elements.password.required = !on;
	};

	const applyAuthMode = (targetMode: 'login' | 'register'): void => {
		setRecovery(false);
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

	portal.querySelector('[data-portal-action="forgot-password"]')?.addEventListener('click', () => {
		applyAuthMode('login');
		setRecovery(true);
		const title = portal.querySelector('[data-auth-title]');
		const note = portal.querySelector('[data-auth-note]');
		if (title) title.textContent = 'Reset your password';
		if (note) note.textContent = 'Enter your account email and we will send you a link to choose a new password.';
		if (elements.submitButton) elements.submitButton.textContent = RECOVERY_SUBMIT_LABEL;
		refreshPortalValidation();
		elements.email.focus();
	});

	portal.querySelectorAll('[data-auth-switch]').forEach((btn) => {
		btn.addEventListener('click', () => {
			applyAuthMode(btn.getAttribute('data-auth-switch') === 'register' ? 'register' : 'login');
		});
	});

	elements.form.addEventListener('submit', (event) => {
		event.preventDefault();
		void (portal.dataset.portalMode === 'recovery' ? submitPortalRecovery(portal, elements) : submitPortalLogin(portal, elements));
	});

	bindLoginCodeStep(portal, {
		auth: authClient,
		passwordForm: elements.form,
		onSession: (token) => completePortalLogin(token, closePortal),
	});

	bindLoginApproveStep(portal, {
		auth: authClient,
		passwordForm: elements.form,
		onSession: (token) => completePortalLogin(token, closePortal),
	});

	void bindPortalOAuth(portal, authConfig.gatewayUrl);

	elements.resendVerification?.addEventListener('click', () => {
		void submitPortalResendVerification(portal, elements);
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

export {
	getAccessToken,
	setAccessToken,
	clearAccessToken,
} from './portal-session';

export {
	mountTurnstile,
	resetTurnstile,
	type TurnstileApi,
} from './portal-turnstile';

export {
	submitPortalLogin,
	submitPortalRecovery,
	submitPortalResendVerification,
	completePortalLogin,
	RECOVERY_SUBMIT_LABEL,
} from './portal-auth-flow';

export {
	type PortalFormElements,
	portalFormElements,
	readTurnstileToken,
	clearPortalFieldErrors,
	showPortalFieldError,
	portalRegistrationProfile,
	clearPortalAuthErrors,
	validateRegistrationIdentity,
	validatePortalPasswordFields,
	validatePortalProfileFields,
	emailValidationResult,
	hasValidEmailFormat,
	showInlineFieldMessage,
	showInlineFieldError,
	clearInlineFieldError,
	validateEmailField,
	usernameValidationState,
	bindEmailFieldValidation,
	updatePortalSubmitAvailability,
	validateRegistrationAvailability,
	validatePortalAuth,
} from './portal-validation';

export {
	STRENGTH_LABELS,
	renderPasswordStrength,
	syncPasswordMatchStatus,
	syncPortalPasswordFeedback,
} from './portal-strength';