import { insertTrustedHTML, queryElement, isHtmlElement } from '../lib/dom-utils';
import { authConfig } from '../lib/auth-config';
import { useAuth } from '../hooks/useAuth';
import { setMountedMascotMood, notifyWithMascot } from './mascot';
import { announce, ensureButtonLabels } from './theme';
import { readConsentPreferences } from './consent';
import { NEWSLETTER_INTENT_KEY } from '../data/legal';
import { readStorage } from '../lib/storage';
import { bindLoginCodeStep, showLoginCodeStep } from './portal-login-code';
import { bindLoginApproveStep, showLoginApproveStep } from './portal-login-approve';
import { createPortalMarkup } from './portal-markup';
import { bindPortalOAuth } from './portal-oauth';
import { isTrustedOsionosRedirect } from '../lib/osionos-redirect';

import {
	LOCAL_TURNSTILE_TOKEN,
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

import {
	STRENGTH_LABELS,
	renderPasswordStrength,
	syncPasswordMatchStatus,
	syncPortalPasswordFeedback,
} from './portal-strength';

export type PortalMode = 'start' | 'connect';

type TurnstileApi = {
	render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void }) => string;
	reset?: (widgetId?: string) => void;
};

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

const ACCESS_TOKEN_KEY = 'auth_token';

export function getAccessToken(): string | null {
	return readStorage(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
	if (token) {
		sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
	} else {
		sessionStorage.removeItem(ACCESS_TOKEN_KEY);
	}
}

export function clearAccessToken(): void {
	setAccessToken(null);
}

const authClient = useAuth();
let portalPreviousFocus: HTMLElement | null = null;
let portalReleaseFocusTrap: (() => void) | null = null;

export function mountTurnstile(portal: HTMLElement): void {
	const container = portal.querySelector('[data-turnstile-slot]');
	if (!(container instanceof HTMLElement)) return;

	if (!authConfig.turnstileSiteKey) {
		const tokenInput = portal.querySelector('[data-turnstile-token]');
		if (tokenInput instanceof HTMLInputElement) {
			tokenInput.value = LOCAL_TURNSTILE_TOKEN;
		}
		return;
	}

	const render = (): void => {
		const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
		if (!turnstile) return;
		try {
			turnstile.render(container, {
				sitekey: authConfig.turnstileSiteKey,
				callback: (token: string) => {
					const tokenInput = portal.querySelector('[data-turnstile-token]');
					if (tokenInput instanceof HTMLInputElement) tokenInput.value = token;
					const form = portal.querySelector('form.portal-login');
					if (form instanceof HTMLFormElement) {
						const elements = portalFormElements(portal);
						if (elements) updatePortalSubmitAvailability(portal, elements);
					}
				},
				'error-callback': () => {
					notifyWithMascot({ kind: 'error', title: 'Verification error', message: 'Turnstile check failed. Please refresh.' });
				},
				'expired-callback': () => {
					const tokenInput = portal.querySelector('[data-turnstile-token]');
					if (tokenInput instanceof HTMLInputElement) tokenInput.value = '';
					const form = portal.querySelector('form.portal-login');
					if (form instanceof HTMLFormElement) {
						const elements = portalFormElements(portal);
						if (elements) updatePortalSubmitAvailability(portal, elements);
					}
				},
			});
		} catch {
			// Container already rendered or widget reset
		}
	};

	if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) {
		render();
	} else {
		const check = setInterval(() => {
			if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) {
				clearInterval(check);
				render();
			}
		}, 100);
		setTimeout(() => clearInterval(check), 10000);
	}
}

export function bindPasswordToggles(root: ParentNode = document): void {
	root.querySelectorAll('[data-toggle-password]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const targetId = btn.getAttribute('data-toggle-password');
			const input = targetId ? root.querySelector(`#${targetId}`) : null;
			if (!(input instanceof HTMLInputElement)) return;
			const isPassword = input.type === 'password';
			input.type = isPassword ? 'text' : 'password';
			btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
			btn.setAttribute('aria-pressed', String(isPassword));
			const icon = btn.querySelector('.portal-toggle-text');
			if (icon instanceof HTMLElement) icon.textContent = isPassword ? 'Hide' : 'Show';
		});
	});
}

async function syncStoredConsents(_token: string, email?: string): Promise<void> {
	const preferences = readConsentPreferences();
	if (preferences?.newsletter && email) {
		await fetch('/api/newsletter/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, newsletter_consent: true }),
		}).catch(() => undefined);
	}
	const newsletterIntent = readStorage(NEWSLETTER_INTENT_KEY);
	if (newsletterIntent && email) {
		await fetch('/api/newsletter/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, newsletter_consent: true }),
		}).catch(() => undefined);
	}
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

async function submitPortalResendVerification(portal: HTMLElement, elements: PortalFormElements): Promise<void> {
	const result = await authClient.resendVerification({ email: elements.email.value.trim(), turnstileToken: readTurnstileToken(portal) });
	const succeeded = result.ok;
	elements.error.textContent = succeeded ? 'A new confirmation link is on its way. Check your inbox.' : humanAuthMessage(result.message);
	elements.error.removeAttribute('hidden');
	if (succeeded) elements.resendVerification?.setAttribute('hidden', '');
	notifyWithMascot({ kind: succeeded ? 'success' : 'error', title: succeeded ? 'Link sent' : 'Could not send a new link', message: elements.error.textContent });
}

const RECOVERY_SUBMIT_LABEL = 'Send reset link';

async function submitPortalRecovery(portal: HTMLElement, elements: PortalFormElements): Promise<void> {
	const email = elements.email;
	clearPortalFieldErrors(email);
	if (!validateEmailField(email, 'Please enter your email address')) {
		showPortalFieldError(elements.error, email, 'Please enter a valid email address (e.g. you@example.com)');
		return;
	}
	setPortalSubmitBusy(elements.submitButton, true, false);
	try {
		const result = await authClient.recover({ email: email.value.trim(), turnstileToken: readTurnstileToken(portal) });
		elements.error.textContent = result.ok
			? 'If an account uses this address, a reset link has been sent to it. Check your inbox.'
			: humanAuthMessage(result.message);
		elements.error.removeAttribute('hidden');
		notifyWithMascot(result.ok
			? { kind: 'success', title: 'Reset link sent', message: 'Check your email inbox.' }
			: { kind: 'error', title: 'Recovery failed', message: elements.error.textContent });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not request password recovery.';
		elements.error.textContent = humanAuthMessage(message);
		elements.error.removeAttribute('hidden');
		notifyWithMascot({ kind: 'error', title: 'Recovery failed', message: elements.error.textContent });
	} finally {
		setPortalSubmitBusy(elements.submitButton, false, false);
		if (elements.submitButton) elements.submitButton.textContent = RECOVERY_SUBMIT_LABEL;
	}
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

async function processPortalLogin(portal: HTMLElement, elements: PortalFormElements, turnstileToken: string): Promise<void> {
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
		if (authenticated.code === 'email_not_confirmed' || messageMentions(message, 'email not confirmed', 'not confirmed', 'confirm your email')) {
			elements.error.textContent = message;
			elements.error.removeAttribute('hidden');
			elements.resendVerification?.removeAttribute('hidden');
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
	if (authenticated.mfaRequired === 'email_approve') {
		showLoginApproveStep(portal, elements.form, authenticated.match);
		return;
	}
	if (authenticated.mfaRequired === 'email_otp') {
		showLoginCodeStep(portal, elements.form);
		return;
	}
	await completePortalLogin(authenticated.accessToken, elements.email.value.trim());
}

// The hand-off after a session exists, whether the password alone or the emailed code produced it.
async function completePortalLogin(sessionToken: string | undefined, email: string): Promise<void> {
	if (sessionToken) {
		setAccessToken(sessionToken);
		await syncStoredConsents(sessionToken, email);
	}
	const osionosBridge = sessionToken
		? await authClient.osionosSession(sessionToken).catch(() => null)
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
		else await processPortalLogin(portal, elements, turnstileToken);
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
		onSession: (token) => completePortalLogin(token, elements.email.value.trim()),
	});

	bindLoginApproveStep(portal, {
		auth: authClient,
		passwordForm: elements.form,
		onSession: (token) => completePortalLogin(token, elements.email.value.trim()),
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