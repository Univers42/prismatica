import { secureRandom, randomBetween, randomIndex, clamp } from '../lib/math';
import { trustedHTML, setTrustedInnerHTML, insertTrustedHTML, queryElement, queryElements, isButton, isHtmlElement, isInput } from '../lib/dom-utils';
import { bindSkipLinkFocus } from "../lib/a11y";
import { bindScrollReveal } from "../lib/scroll-reveal";
import { rehydrateAndReflectAuth, bindLogoutControls } from "../lib/auth-ui";
import { bindDataRightsForm } from "../lib/gdpr-form";
import { readStorage, writeStorage } from '../lib/storage';
/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   main.ts                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { type ThemeName, THEMES, normalizeTheme, themeDisplayName, themeIcon } from '../lib/theme-config';
import { type ConsentPreferences, storeConsentPreferences, readConsentPreferences, bindConsentBanner } from './consent';
import './premium';
import { initialTheme, applyTheme, applyMotionPreference, bindThemeControls } from './theme';
import { MiniBaasError } from '@grobase/js';
import { createPublicBaasClient, fetchSeededUsers } from '../lib/baas-client';
import { authConfig } from '../lib/auth-config';
import { type AuthResult, type AvailabilityFieldResult, type RegisterProfile, useAuth, validateEmail, validatePassword } from '../hooks/useAuth';
import { CSRF_STORAGE_KEY, NEWSLETTER_INTENT_KEY, POLICY_VERSION } from '../data/legal';
import { type NotificationKind, type NotificationOptions, dismissAll, notify } from './notifications';
import { type MascotMood, mountMascot, setMountedMascotMood, notifyWithMascot } from './mascot';
import { checkPasswordStrength, passwordRuleResults } from '../lib/auth-validation';

type PortalMode = 'start' | 'connect';

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
	authTitle: Element | null;
	authNote: Element | null;
	submitButton: Element | null;
	termsConsent: Element | null;
	email: Element | null;
	username: Element | null;
	emailVerificationConsent: Element | null;
	password: Element | null;
	confirmPassword: Element | null;
};

declare global {
	var turnstile: TurnstileApi | undefined;
}
const MOTION_KEY = 'prismatica-motion-paused';

/**
 * The short-lived ACCESS token lives only in memory for the lifetime of the
 * page. It is never persisted to localStorage/sessionStorage/cookies, so an XSS
 * cannot read it from storage. The long-lived REFRESH token is held by the
 * server as an HttpOnly Secure cookie and drives rehydration on each page load.
 */
let accessToken: string | null = null;
let portalPreviousFocus: HTMLElement | null = null;
let portalReleaseFocusTrap: (() => void) | null = null;

/** Returns the in-memory access token, or null when logged out. */
function getAccessToken(): string | null {
	return accessToken;
}

/** Stores the access token in memory only. */
function setAccessToken(token: string | null): void {
	accessToken = token && token.length > 0 ? token : null;
}

/** Clears the in-memory access token (used on logout). */
function clearAccessToken(): void {
	accessToken = null;
}

const authClient = useAuth();

/** Returns an element when it matches the expected runtime type. */
/** Returns all elements matching the expected runtime type. */


/** Returns the current Turnstile token or a localhost bypass token when configured. */
function readTurnstileToken(portal: HTMLElement): string {
	const token = portal.querySelector('[data-turnstile-token]');
	if (token instanceof HTMLInputElement && token.value) {
		return token.value;
	}
	return authConfig.turnstileSiteKey ? '' : 'localhost-turnstile-token';
}

/** Renders the Cloudflare Turnstile widget into the active auth portal. */
function mountTurnstile(portal: HTMLElement): void {
	const container = portal.querySelector('[data-turnstile-widget]');
	const token = portal.querySelector('[data-turnstile-token]');
	if (!(container instanceof HTMLElement) || !(token instanceof HTMLInputElement)) {
		return;
	}
	if (!authConfig.turnstileSiteKey) {
		token.value = 'localhost-turnstile-token';
		container.hidden = true;
		return;
	}
	const render = (): void => {
		if (!globalThis.turnstile || container.dataset.widgetId) {
			return;
		}
		container.dataset.widgetId = globalThis.turnstile.render(container, {
			sitekey: authConfig.turnstileSiteKey,
			callback: (value: string) => {
				token.value = value;
			},
			'error-callback': () => {
				token.value = '';
			},
			'expired-callback': () => {
				token.value = '';
			},
		});
	};
	render();
	if (!container.dataset.widgetId) {
		globalThis.setTimeout(render, 600);
	}
}



/** Chooses the initial theme from storage or system preference. */
function ensureButtonLabels(): void {
	queryElements('button', (element): element is HTMLButtonElement => element instanceof HTMLButtonElement).forEach((button) => {
		if (button.getAttribute('aria-label') || button.getAttribute('aria-labelledby')) {
			return;
		}
		const label = (button.textContent ?? '').replaceAll(/\s+/g, ' ').trim() || button.title.trim();
		if (label) {
			button.setAttribute('aria-label', label);
		}
	});
}

function bindPasswordToggles(root: ParentNode = document): void {
	Array.from(root.querySelectorAll('[data-password-toggle]')).forEach((toggle) => {
		if (!(toggle instanceof HTMLButtonElement) || toggle.dataset.passwordToggleBound === 'true') return;
		const inputId = toggle.getAttribute('aria-controls');
		const input = inputId ? root.querySelector(`#${CSS.escape(inputId)}`) : null;
		if (!(input instanceof HTMLInputElement)) return;
		toggle.dataset.passwordToggleBound = 'true';
		toggle.addEventListener('click', () => {
			const show = input.type === 'password';
			input.type = show ? 'text' : 'password';
			toggle.setAttribute('aria-pressed', String(show));
			const targetName = toggle.dataset.passwordTargetName ?? toggle.getAttribute('aria-label')?.replace(/^(Show|Hide)\s+/i, '') ?? 'password';
			const nextVerb = show ? 'Hide' : 'Show';
			toggle.dataset.passwordTargetName = targetName;
			toggle.setAttribute('aria-label', `${nextVerb} ${targetName}`);
			toggle.title = `${nextVerb} ${targetName}`;
			const icon = toggle.querySelector('[aria-hidden="true"]');
			if (icon instanceof HTMLElement) icon.textContent = show ? '◎' : '◉';
			input.focus({ preventScroll: true });
		});
	});
}

/** Draws a subtle paper grain on the decorative canvas. */
function renderPaperGrain(): void {
	const canvas = queryElement('#paper-grain', (element): element is HTMLCanvasElement => element instanceof HTMLCanvasElement);
	if (!canvas) {
		return;
	}
	const context = canvas.getContext('2d');
	if (!context) {
		return;
	}
	const ratio = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = Math.floor(window.innerWidth * ratio);
	canvas.height = Math.floor(window.innerHeight * ratio);
	canvas.style.width = `${window.innerWidth}px`;
	canvas.style.height = `${window.innerHeight}px`;
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	context.clearRect(0, 0, window.innerWidth, window.innerHeight);
	for (let index = 0; index < 900; index += 1) {
		const alpha = secureRandom() * 0.05;
		context.fillStyle = `rgba(28, 22, 18, ${alpha})`;
		context.fillRect(secureRandom() * window.innerWidth, secureRandom() * window.innerHeight, randomBetween(0.4, 1.8), randomBetween(0.4, 1.8));
	}
}

/** Announces dynamic state changes to assistive technology. */
function announce(message: string): void {
	const announcer = queryElement('#global-announcer', isHtmlElement);
	if (announcer) {
		announcer.textContent = message;
	}
}

/** Reads the current in-memory auth token for authenticated RPC calls. */
function readAuthToken(): string | null {
	return getAccessToken();
}

type RpcStatus = {
	ok: boolean;
	status: number;
};

/** Calls a GDPR RPC with either the user's token or the anon key. */
async function callGdprRpc(name: string, body: Record<string, unknown>, token = readAuthToken()): Promise<RpcStatus> {
	try {
		await createPublicBaasClient(token ?? undefined).rpc(name, body);
		return { ok: true, status: 200 };
	} catch (error) {
		if (error instanceof MiniBaasError) return { ok: false, status: error.status };
		throw error;
	}
}

/** Authenticates a portal login through the public BaaS gateway. */
async function authenticatePortalLogin(email: string, password: string, turnstileToken: string): Promise<AuthResult> {
	const payload = await authClient.signIn({ email, password, turnstileToken });
	if (payload.ok && typeof payload.accessToken === 'string' && payload.accessToken.length > 0) {
		setAccessToken(payload.accessToken);
	}
	return payload;
}

/** Registers a portal account through the Turnstile-protected auth gateway. */
async function registerPortalAccount(email: string, password: string, turnstileToken: string, profile: RegisterProfile): Promise<AuthResult> {
	const payload = await authClient.register({ email, password, turnstileToken, profile });
	return payload;
}

/**
 * Rehydrates the in-memory access token on a fresh page load by exchanging the
 * HttpOnly refresh cookie for a new access token. Returns true when a session
 * was restored, false when there is no/expired session. The refresh
 * cookie is sent automatically because useAuth posts with credentials:'include'.
 */
async function rehydrateSession(): Promise<boolean> {
	if (getAccessToken()) {
		return true;
	}
	try {
		const payload = await authClient.refresh();
		if (payload.ok && typeof payload.accessToken === 'string' && payload.accessToken.length > 0) {
			setAccessToken(payload.accessToken);
			return true;
		}
	} catch {
		// Network/parse failure: treat as logged-out, no token retained.
	}
	clearAccessToken();
	return false;
}

/** Logs out: clears the in-memory token and the server-side refresh cookie. */
async function logoutSession(): Promise<void> {
	clearAccessToken();
	await authClient.logout().catch(() => undefined);
}

/**
 * Defense-in-depth open-redirect guard: confirms a bridge-provided redirect URL
 * shares the configured osionos origin before we navigate. Even though the URL
 * comes from our own trusted bridge, we never assign() to an unexpected origin.
 */
function isTrustedOsionosRedirect(redirectUrl: string): boolean {
	const expectedOrigin = String(import.meta.env.PUBLIC_OSIONOS_APP_URL ?? '').trim();
	if (!expectedOrigin) {
		return false;
	}
	try {
		return new URL(redirectUrl).origin === new URL(expectedOrigin).origin;
	} catch {
		return false;
	}
}

/** Requests a password recovery email without revealing whether the account exists. */
async function requestPasswordRecovery(email: string, turnstileToken: string): Promise<void> {
	const response = await authClient.recover({ email, turnstileToken });
	if (!response.ok && response.status >= 500) {
		throw new Error('Password recovery service is unavailable.');
	}
}

async function requestNewsletterSubscription(email: string): Promise<AuthResult> {
	const response = await fetch('/api/newsletter/subscribe', {
		method: 'POST',
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: email.trim() }),
	});
	const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
	return {
		ok: response.ok,
		status: response.status,
		message: payload.message ?? payload.error ?? (response.ok ? 'Check your inbox to confirm your subscription.' : 'Could not send the newsletter confirmation email.'),
	};
}

/** Synchronises locally stored newsletter consent after login when possible. */
async function syncStoredConsents(_token: string, email?: string): Promise<void> {
	const preferences = readConsentPreferences();
	if (preferences?.newsletter && email) {
		await requestNewsletterSubscription(email).catch(() => undefined);
	}

	const newsletterIntent = readStorage(NEWSLETTER_INTENT_KEY);
	if (newsletterIntent && email) {
		await requestNewsletterSubscription(email).catch(() => undefined);
		localStorage.removeItem(NEWSLETTER_INTENT_KEY);
	}
}

/** Returns the full original Binocle mascot SVG structure with tubes, barrels and expression layers. */
/** Creates the portal document fragment. */
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
								<input id="portal-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required />
								<p id="portal-email-inline-error" class="field-validation-message" data-validation-state="idle" aria-live="polite">We verify the email format before sending it.</p>
							</div>
						</div>
						<div class="field" data-password-field>
							<label for="portal-password">Password <span aria-hidden="true">*</span></label>
							<div class="password-control">
								<input id="portal-password" name="password" type="password" autocomplete="current-password" placeholder="8+ chars, A–z, 0–9, symbol" required />
								<button class="password-control__toggle" type="button" data-password-toggle aria-label="Show password" aria-controls="portal-password" aria-pressed="false" title="Show password"><span aria-hidden="true">◉</span></button>
							</div>
							<p class="portal-password-hint portal-register-only">Minimum 8 characters with uppercase, lowercase, number and symbol.</p>
							<div class="password-strength portal-register-only" data-password-strength data-strength-level="empty" aria-live="polite">
								<div class="password-strength__meter" aria-hidden="true">
									<span class="password-strength__segment" data-password-segment></span>
									<span class="password-strength__segment" data-password-segment></span>
									<span class="password-strength__segment" data-password-segment></span>
									<span class="password-strength__segment" data-password-segment></span>
								</div>
								<span class="password-strength__label" data-password-strength-label>Enter a password</span>
								<ul class="password-strength__rules" data-password-rules></ul>
							</div>
							<button class="portal-link portal-link--button portal-login-only" type="button" data-forgot-password>Forgot your password?</button>
						</div>
						<div class="field portal-register-only">
							<label for="portal-password-confirm">Repeat password <span aria-hidden="true">*</span></label>
							<div class="password-control">
								<input id="portal-password-confirm" name="password_confirm" type="password" autocomplete="new-password" placeholder="Repeat your password" required />
								<button class="password-control__toggle" type="button" data-password-toggle aria-label="Show repeated password" aria-controls="portal-password-confirm" aria-pressed="false" title="Show repeated password"><span aria-hidden="true">◉</span></button>
							</div>
							<p id="portal-password-match" class="password-match" data-password-match aria-live="polite">Repeat the same password.</p>
						</div>
						<label class="consent-toggle portal-consent" for="portal-terms-consent">
							<input id="portal-terms-consent" name="terms_consent" type="checkbox" required />
							<span>I have read and accept the <a href="/legal/terms/" target="_blank" rel="noreferrer">Terms of Service</a> and <a href="/legal/privacy-policy/" target="_blank" rel="noreferrer">Privacy Policy</a>.</span>
						</label>
						<label class="consent-toggle portal-consent" for="portal-email-verification-consent">
							<input id="portal-email-verification-consent" name="email_verification_consent" type="checkbox" ${requiresEmailVerification ? 'checked required' : ''} />
							<span>${requiresEmailVerification ? 'Send the email verification link required to activate this account.' : 'Development option: send a verification email instead of auto-confirming this local account.'}</span>
						</label>
						<label class="consent-toggle portal-consent" for="portal-newsletter-consent">
							<input id="portal-newsletter-consent" name="newsletter_consent" type="checkbox" />
							<span>I agree to receive the Prismatica newsletter. This is optional and has no effect on account access.</span>
						</label>
						<p class="portal-verification-note portal-register-only">Security and workspace notifications are enabled automatically. You can change preferences later in your workspace.</p>
						<div class="turnstile-box" data-turnstile-widget aria-label="Anti-abuse verification"></div>
						<input type="hidden" name="turnstile_token" data-turnstile-token />
						<button class="portal-cta" type="submit" data-login-submit>${quick ? 'Sign in securely →' : 'Create protected account →'}</button>
						<div class="portal-recovery-actions" data-recovery-actions hidden>
							<button class="portal-cta" type="submit" data-recovery-submit>Send reset link</button>
							<button class="portal-secondary" type="button" data-cancel-recovery>Back to login</button>
						</div>
						<button class="portal-secondary" type="button" data-close-portal>Return to the tour</button>
						<output id="portal-error-msg" class="portal-error" role="status" aria-live="polite" aria-atomic="true"></output>
					</form>
				</div>
			</section>
			<section class="portal__panel portal__panel--preview" aria-label="Connection summary">
				<div class="portal-demo-area">
					<p class="portal-kicker portal-kicker--future">Connection summary</p>
					<h3>One account, two workspaces.</h3>
					<p class="portal-summary">Your Prismatica identity opens a dedicated osionos workspace through the secure bridge.</p>
					<div class="portal-cards" aria-label="Security assurances">
						<article class="portal-card"><span>01</span><h3>HTTPS gateway</h3><p>Browser requests stay behind the website gateway.</p></article>
						<article class="portal-card"><span>02</span><h3>Verified identity</h3><p>${requiresEmailVerification ? 'New accounts activate after email confirmation.' : 'Local accounts can auto-confirm in development.'}</p></article>
						<article class="portal-card"><span>03</span><h3>App access</h3><p>osionos receives a signed session, not database credentials.</p></article>
					</div>
				</div>
			</section>
		</dialog>`;
}

// Native <dialog>.showModal() handles focus trap and ESC for us; the manual
// trapFocus and focusableElements helpers that lived here were removed in Step A.

type PortalFormElements = {
	error: HTMLOutputElement;
	email: HTMLInputElement;
	password: HTMLInputElement;
	confirmPassword: HTMLInputElement | null;
	username: HTMLInputElement | null;
	emailVerificationConsent: HTMLInputElement | null;
	termsConsent: HTMLInputElement | null;
	newsletterConsent: HTMLInputElement | null;
	submitButton: HTMLButtonElement | null;
};

/** Returns the typed portal form controls needed by submit handlers. */
function portalFormElements(portal: HTMLElement): PortalFormElements | null {
	const error = portal.querySelector('.portal-error');
	const email = portal.querySelector('#portal-email');
	const password = portal.querySelector('#portal-password');
	const confirmPassword = portal.querySelector('#portal-password-confirm');
	const username = portal.querySelector('#portal-username');
	const emailVerificationConsent = portal.querySelector('#portal-email-verification-consent');
	const termsConsent = portal.querySelector('#portal-terms-consent');
	const newsletterConsent = portal.querySelector('#portal-newsletter-consent');
	const submitButton = portal.querySelector('[data-login-submit]');
	if (!(error instanceof HTMLOutputElement) || !(email instanceof HTMLInputElement) || !(password instanceof HTMLInputElement)) {
		return null;
	}
	return {
		error,
		email,
		password,
		confirmPassword: confirmPassword instanceof HTMLInputElement ? confirmPassword : null,
		username: username instanceof HTMLInputElement ? username : null,
		emailVerificationConsent: emailVerificationConsent instanceof HTMLInputElement ? emailVerificationConsent : null,
		termsConsent: termsConsent instanceof HTMLInputElement ? termsConsent : null,
		newsletterConsent: newsletterConsent instanceof HTMLInputElement ? newsletterConsent : null,
		submitButton: submitButton instanceof HTMLButtonElement ? submitButton : null,
	};
}

/** Clears invalid state from portal controls. */
function clearPortalFieldErrors(...fields: HTMLInputElement[]): void {
	fields.forEach((field) => {
		field.removeAttribute('aria-invalid');
		field.removeAttribute('aria-describedby');
	});
}

/** Marks a portal input as invalid and focuses it. */
function showPortalFieldError(error: HTMLOutputElement, field: HTMLInputElement, message: string): void {
	error.textContent = message;
	field.setAttribute('aria-invalid', 'true');
	field.setAttribute('aria-describedby', 'portal-error-msg');
	field.focus();
}

/** Builds the schema-aligned registration profile payload. */
function portalRegistrationProfile(elements: PortalFormElements): RegisterProfile {
	return {
		username: elements.username?.value.trim() ?? '',
		confirmPassword: elements.confirmPassword?.value ?? '',
		emailVerificationConsent: authConfig.requireEmailVerification ? (elements.emailVerificationConsent?.checked ?? true) : Boolean(elements.emailVerificationConsent?.checked),
		newsletterConsent: Boolean(elements.newsletterConsent?.checked),
		notificationsEnabled: true,
	};
}

/** Clears invalid states across the dynamic portal auth controls. */
function clearPortalAuthErrors(elements: PortalFormElements): void {
	const optionalFields = [elements.confirmPassword, elements.username, elements.emailVerificationConsent].filter((field): field is HTMLInputElement => field instanceof HTMLInputElement);
	clearPortalFieldErrors(elements.email, elements.password, ...optionalFields);
}

/** Validates registration-only identity fields. */
function validateRegistrationIdentity(elements: PortalFormElements, isRegister: boolean): boolean {
	const { email, error, username } = elements;
	const usernamePattern = /^\w[\w.-]{2,31}$/;
	if (isRegister && username && !usernamePattern.test(username.value.trim())) {
		showPortalFieldError(error, username, 'Error: Choose a username with 3–32 letters, numbers, dots, underscores, or hyphens.');
		return false;
	}
	if (!validateEmailField(email, 'Please enter your email address')) {
		showPortalFieldError(error, email, 'Please enter a valid email address (e.g. you@example.com)');
		return false;
	}
	return true;
}

/** Validates login and registration password fields. */
function validatePortalPasswordFields(elements: PortalFormElements, isRegister: boolean): boolean {
	const { confirmPassword, error, password } = elements;
	if (isRegister && (!validatePassword(password.value) || !checkPasswordStrength(password.value).passed)) {
		showPortalFieldError(error, password, 'Error: Your password does not meet the security requirements.');
		notifyWithMascot({
			kind: 'warning',
			title: 'Password too weak',
			message: 'Your password does not meet the security requirements.',
			duration: 5000,
		});
		return false;
	}
	if (isRegister && confirmPassword && password.value !== confirmPassword.value) {
		showPortalFieldError(error, confirmPassword, 'Error: Repeat the same password.');
		notifyWithMascot({
			kind: 'warning',
			title: 'Passwords do not match',
			message: 'Make sure both fields are identical.',
			duration: 5000,
		});
		return false;
	}
	if (!isRegister && password.value.length === 0) {
		showPortalFieldError(error, password, 'Error: Enter your password.');
		return false;
	}
	return true;
}

/** Validates profile-only fields that mirror optional users schema columns. */
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
	if (!trimmed) {
		return 'Please check the form and try again.';
	}
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		try {
			const payload = JSON.parse(trimmed) as Record<string, unknown>;
			const candidate = [payload.error_description, payload.msg, payload.message, payload.error].find((value) => typeof value === 'string' && value.trim().length > 0);
			return typeof candidate === 'string' ? candidate : 'Please check the form and try again.';
		} catch {
			return 'Please check the form and try again.';
		}
	}
	return trimmed.replace(/^error:\s*/i, '').slice(0, 220);
}

function messageMentions(message: string, ...needles: string[]): boolean {
	const normalized = message.toLowerCase();
	return needles.some((needle) => normalized.includes(needle.toLowerCase()));
}

/** Validates email beyond native type=email checks for common mistakes. */



import { validateEmailFormat, type EmailValidationResult, type FieldValidationState } from '../lib/email-validation';

function emailValidationResult(field: HTMLInputElement): EmailValidationResult {
	return validateEmailFormat(field.value.trim(), field.required, field.validity.valid);
}

function hasValidEmailFormat(field: HTMLInputElement): boolean {
	return emailValidationResult(field).valid && field.value.trim().length > 0;
}

function describedByValues(field: HTMLInputElement): Set<string> {
	return new Set((field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
}

function ensureInlineFieldMessage(field: HTMLInputElement): HTMLElement {
	const id = `${field.id || field.name || 'field'}-inline-error`;
	let message = document.getElementById(id);
	if (!(message instanceof HTMLElement)) {
		message = document.createElement('p');
		message.id = id;
		message.setAttribute('role', 'alert');
		field.after(message);
	}
	message.className = 'field-validation-message';
	return message;
}

function showInlineFieldMessage(field: HTMLInputElement, message: string, state: FieldValidationState): void {
	const messageElement = ensureInlineFieldMessage(field);
	messageElement.textContent = message;
	messageElement.dataset.validationState = state;
	if (state === 'error') {
		field.setAttribute('aria-invalid', 'true');
	} else {
		field.removeAttribute('aria-invalid');
	}
	const describedBy = describedByValues(field);
	describedBy.add(messageElement.id);
	field.setAttribute('aria-describedby', Array.from(describedBy).join(' '));
}

function showInlineFieldError(field: HTMLInputElement, message: string): void {
	showInlineFieldMessage(field, message, 'error');
}

function clearInlineFieldError(field: HTMLInputElement): void {
	const messageElement = document.getElementById(`${field.id || field.name || 'field'}-inline-error`);
	if (messageElement instanceof HTMLElement) {
		messageElement.textContent = '';
		messageElement.dataset.validationState = 'idle';
	}
	const describedBy = describedByValues(field);
	describedBy.delete(`${field.id || field.name || 'field'}-inline-error`);
	if (describedBy.size > 0) {
		field.setAttribute('aria-describedby', Array.from(describedBy).join(' '));
	} else {
		field.removeAttribute('aria-describedby');
	}
	field.removeAttribute('aria-invalid');
}

function validateEmailField(field: HTMLInputElement, emptyMessage?: string): boolean {
	const result = emailValidationResult(field);
	if (field.value.trim().length === 0) {
		if (emptyMessage) {
			showInlineFieldError(field, emptyMessage);
			return false;
		}
		clearInlineFieldError(field);
		return !field.required;
	}
	if (!result.valid) {
		showInlineFieldError(field, result.message);
		return false;
	}
	showInlineFieldMessage(field, result.message, result.state);
	return true;
}

function updateEmailFieldFeedback(field: HTMLInputElement): void {
	const result = emailValidationResult(field);
	if (result.state === 'idle') {
		clearInlineFieldError(field);
		return;
	}
	showInlineFieldMessage(field, result.message, result.state);
}

function usernameValidationState(field: HTMLInputElement): { valid: boolean; message: string; state: FieldValidationState } {
	const username = field.value.trim();
	if (!username) {
		return { valid: false, message: 'Choose a unique username.', state: 'idle' };
	}
	if (!/^\w[\w.-]{2,31}$/.test(username)) {
		return { valid: false, message: 'Use 3–32 letters, numbers, dots, underscores, or hyphens.', state: 'error' };
	}
	return { valid: true, message: 'Checking username availability…', state: 'warning' };
}

function setPortalAvailabilityState(portal: HTMLElement, field: 'email' | 'username', state: 'unknown' | 'checking' | 'available' | 'taken'): void {
	portal.dataset[`${field}Available`] = state;
}

function showAvailabilityResult(field: HTMLInputElement, result: AvailabilityFieldResult): void {
	if (result.available === false) {
		showInlineFieldMessage(field, result.message, 'error');
		field.setAttribute('aria-invalid', 'true');
		return;
	}
	if (result.available === true) {
		showInlineFieldMessage(field, result.message, 'success');
		field.removeAttribute('aria-invalid');
	}
}

function availabilityStateAllowsSubmit(portal: HTMLElement, field: 'email' | 'username'): boolean {
	const state = portal.dataset[`${field}Available`];
	return state !== 'checking' && state !== 'taken';
}

function bindEmailFieldValidation(scope: ParentNode = document): void {
	queryElements('input[type="email"]', (element): element is HTMLInputElement => element instanceof HTMLInputElement).forEach((field) => {
		if ((scope instanceof Node && !scope.contains(field)) || field.dataset.emailValidationBound === 'true') {
			return;
		}
		field.dataset.emailValidationBound = 'true';
		field.addEventListener('blur', () => validateEmailField(field));
		field.addEventListener('input', () => updateEmailFieldFeedback(field));
	});
}

function renderPasswordStrength(root: HTMLElement, password: string): void {
	const result = checkPasswordStrength(password);
	root.dataset.strengthLevel = result.level;
	root.querySelectorAll('[data-password-segment]').forEach((segment, index) => {
		segment.classList.toggle('is-filled', index < result.score);
	});
	const label = root.querySelector('[data-password-strength-label]');
	if (label instanceof HTMLElement) {
		label.textContent = result.level === 'empty' ? 'Enter a password' : `${result.level[0].toUpperCase()}${result.level.slice(1)} password`;
	}
	const rules = root.querySelector('[data-password-rules]');
	if (rules instanceof HTMLUListElement) {
		rules.replaceChildren(...passwordRuleResults(password).map((rule) => {
			const item = document.createElement('li');
			item.className = `password-strength__rule ${rule.passed ? 'is-met' : 'is-unmet'}`;
			item.textContent = rule.label;
			return item;
		}));
	}
}

function syncPasswordMatchStatus(match: HTMLElement | null, password: HTMLInputElement, confirmPassword: HTMLInputElement): boolean {
	if (!match) {
		return password.value === confirmPassword.value;
	}
	const hasConfirmation = confirmPassword.value.length > 0;
	const matches = hasConfirmation && password.value === confirmPassword.value;
	match.classList.toggle('is-match', matches);
	match.classList.toggle('is-mismatch', hasConfirmation && !matches);
	let message = 'Repeat the same password.';
	if (matches) {
		message = 'Passwords match.';
	} else if (hasConfirmation) {
		message = 'Passwords do not match.';
	}
	match.textContent = message;
	return matches;
}

function syncPortalPasswordFeedback(portal: HTMLElement, elements: PortalFormElements): boolean {
	const strengthRoot = portal.querySelector('[data-password-strength]');
	if (strengthRoot instanceof HTMLElement) {
		renderPasswordStrength(strengthRoot, elements.password.value);
	}
	const match = portal.querySelector('[data-password-match]');
	let matchElement: HTMLElement | null = null;
	if (match instanceof HTMLElement) {
		matchElement = match;
	}
	let passwordsMatch = true;
	if (elements.confirmPassword) {
		passwordsMatch = syncPasswordMatchStatus(matchElement, elements.password, elements.confirmPassword);
	}
	return checkPasswordStrength(elements.password.value).passed && passwordsMatch;
}

function updatePortalSubmitAvailability(portal: HTMLElement, elements: PortalFormElements): void {
	if (!(elements.submitButton instanceof HTMLButtonElement) || elements.submitButton.dataset.busy === 'true' || portal.dataset.portalMode === 'recovery') {
		return;
	}
	if (portal.dataset.authMode !== 'register') {
		elements.submitButton.disabled = !hasValidEmailFormat(elements.email);
		return;
	}
	const passwordReady = syncPortalPasswordFeedback(portal, elements);
	const termsReady = !(elements.termsConsent instanceof HTMLInputElement) || elements.termsConsent.checked;
	const verificationReady = !authConfig.requireEmailVerification || !(elements.emailVerificationConsent instanceof HTMLInputElement) || elements.emailVerificationConsent.checked;
	const usernameReady = !(elements.username instanceof HTMLInputElement) || /^\w[\w.-]{2,31}$/.test(elements.username.value.trim());
	const availabilityReady = availabilityStateAllowsSubmit(portal, 'email') && availabilityStateAllowsSubmit(portal, 'username');
	elements.submitButton.disabled = !(passwordReady && termsReady && verificationReady && usernameReady && hasValidEmailFormat(elements.email) && availabilityReady);
}

/** Handles the password recovery variant of the portal form. */
async function submitPortalRecovery(portal: HTMLElement, elements: PortalFormElements): Promise<void> {
	const { email, error } = elements;
	const turnstileToken = readTurnstileToken(portal);
	clearPortalFieldErrors(email);
	if (!validateEmailField(email, 'Please enter your email address')) {
		showPortalFieldError(error, email, email.value.trim().length === 0 ? 'Please enter your email address' : 'Please enter a valid email address (e.g. you@example.com)');
		return;
	}
	if (!turnstileToken) {
		error.textContent = 'Error: Complete the anti-abuse check.';
		return;
	}
	const recoverySubmit = portal.querySelector('[data-recovery-submit]');
	setMountedMascotMood('listening', 1600);
	if (recoverySubmit instanceof HTMLButtonElement) {
		recoverySubmit.disabled = true;
		recoverySubmit.textContent = 'Sending…';
	}
	try {
		await requestPasswordRecovery(email.value, turnstileToken);
		notifyWithMascot({
			kind: 'success',
			title: 'Reset link sent',
			message: 'If an account exists for that email, a reset link has been sent.',
			duration: 6000,
		});
		announce('If an account exists for that email, a reset link has been sent.');
	} catch {
		notifyWithMascot({
			kind: 'error',
			title: 'Connection failed',
			message: 'Could not reach the server. Check your connection and try again.',
			duration: 8000,
		});
		setMountedMascotMood('scared', 1200);
		announce('Network error — please try again later.');
	} finally {
		if (recoverySubmit instanceof HTMLButtonElement) {
			recoverySubmit.disabled = false;
			recoverySubmit.textContent = 'Send reset link';
		}
	}
}

function validateRegistrationAvailability(portal: HTMLElement, elements: PortalFormElements, isRegister: boolean): boolean {
	if (!isRegister) {
		return true;
	}
	if (portal.dataset.usernameAvailable === 'checking' || portal.dataset.emailAvailable === 'checking') {
		elements.error.textContent = 'Checking username and email availability…';
		return false;
	}
	if (portal.dataset.usernameAvailable === 'taken' && elements.username) {
		showPortalFieldError(elements.error, elements.username, 'Error: This username is already taken.');
		return false;
	}
	if (portal.dataset.emailAvailable === 'taken') {
		showPortalFieldError(elements.error, elements.email, 'Error: This email is already registered.');
		return false;
	}
	return true;
}

/** Validates portal auth input and returns the Turnstile token when valid. */
function validatePortalAuth(portal: HTMLElement, elements: PortalFormElements, isRegister: boolean): string | null {
	const turnstileToken = readTurnstileToken(portal);
	clearPortalAuthErrors(elements);
	if (!validateRegistrationIdentity(elements, isRegister) || !validatePortalPasswordFields(elements, isRegister) || !validatePortalProfileFields(elements, isRegister)) {
		return null;
	}
	if (!validateRegistrationAvailability(portal, elements, isRegister)) {
		return null;
	}
	if (!turnstileToken) {
		elements.error.textContent = 'Error: Complete the anti-abuse check.';
		return null;
	}
	elements.error.textContent = '';
	return turnstileToken;
}

/** Updates the portal submit button busy state. */
function setPortalSubmitBusy(button: HTMLButtonElement | null, busy: boolean, isRegister: boolean): void {
	if (!button) {
		return;
	}
	button.dataset.busy = String(busy);
	button.disabled = busy;
	if (busy) {
		button.textContent = isRegister ? 'Creating…' : 'Connecting…';
		return;
	}
	button.textContent = isRegister ? 'Create protected account →' : 'Sign in securely →';
}

/** Handles a validated registration request. */
async function processPortalRegistration(elements: PortalFormElements, turnstileToken: string): Promise<void> {
	const result = await registerPortalAccount(elements.email.value, elements.password.value, turnstileToken, portalRegistrationProfile(elements));
	const message = humanAuthMessage(result.message);
	if (result.ok) {
		notifyWithMascot({
			kind: 'success',
			title: 'Account created',
			message: authConfig.requireEmailVerification ? 'Check your email to confirm your address before signing in.' : 'Development account created. You can sign in now.',
			duration: 7000,
		});
		setMountedMascotMood('excited', 2000);
		announce(authConfig.requireEmailVerification ? 'Account created. Check your email before signing in.' : 'Development account created. You can sign in now.');
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

/** Handles a validated login request. */
async function processPortalLogin(elements: PortalFormElements, turnstileToken: string): Promise<void> {
	const authenticated = await authenticatePortalLogin(elements.email.value, elements.password.value, turnstileToken);
	const message = humanAuthMessage(authenticated.message);
	if (!authenticated.ok) {
		if (authenticated.status === 429) {
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
		notifyWithMascot({
			kind: 'error',
			title: 'Connection failed',
			message,
			duration: 8000,
		});
		return;
	}
	await syncStoredConsents(authenticated.accessToken ?? '', elements.email.value);
	if (elements.newsletterConsent?.checked) {
		await requestNewsletterSubscription(elements.email.value).catch(() => undefined);
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
	if (osionosBridge && !osionosBridge.ok) {
		notifyWithMascot({
			kind: 'warning',
			title: 'Workspace bridge pending',
			message: osionosBridge.message,
			duration: 7000,
		});
	}
	notifyWithMascot({
		kind: 'success',
		title: 'Welcome back',
		message: `Signed in as ${elements.email.value}`,
		duration: 4000,
	});
	setMountedMascotMood('happy', 1800);
	announce('Successfully connected — welcome back.');
	globalThis.setTimeout(() => closePortal(), 1200);
}

/** Handles the standard login variant of the portal form. */
async function submitPortalLogin(portal: HTMLElement, elements: PortalFormElements): Promise<void> {
	const isRegister = portal.dataset.authMode === 'register';
	const turnstileToken = validatePortalAuth(portal, elements, isRegister);
	if (!turnstileToken) {
		return;
	}
	setPortalSubmitBusy(elements.submitButton, true, isRegister);
	try {
		if (isRegister) {
			await processPortalRegistration(elements, turnstileToken);
			return;
		}
		await processPortalLogin(elements, turnstileToken);
	} catch {
		notifyWithMascot({
			kind: 'error',
			title: 'Connection failed',
			message: 'Could not reach the server. Check your connection and try again.',
			duration: 8000,
		});
		setMountedMascotMood('scared', 1200);
		announce('Connection failed — please check your credentials.');
	} finally {
		setPortalSubmitBusy(elements.submitButton, false, portal.dataset.authMode === 'register');
	}
}

/** Updates portal heading and call-to-action copy for the selected auth mode. */
function syncAuthModeCopy(controls: AuthModeControls, authMode: 'login' | 'register'): void {
	const isLogin = authMode === 'login';
	const registerNote = authConfig.requireEmailVerification
		? 'Create an account with email verification before opening your workspace.'
		: 'Create a local development account and open your workspace.';
	if (controls.authTitle instanceof HTMLElement) {
		controls.authTitle.textContent = isLogin ? 'Open your workspace' : 'Create your workspace';
	}
	if (controls.authNote instanceof HTMLElement) {
		controls.authNote.textContent = isLogin ? 'Sign in to connect Prismatica with the osionos app.' : registerNote;
	}
	if (controls.submitButton instanceof HTMLButtonElement) {
		controls.submitButton.textContent = isLogin ? 'Sign in securely →' : 'Create protected account →';
	}
}

/** Shows the relevant login or registration controls. */
function syncAuthModeVisibility(portal: HTMLElement, authMode: 'login' | 'register'): void {
	const isLogin = authMode === 'login';
	portal.querySelectorAll('.portal-register-only, .portal-consent').forEach((element) => {
		if (element instanceof HTMLElement) {
			element.hidden = isLogin;
		}
	});
	portal.querySelectorAll('.portal-login-only').forEach((element) => {
		if (element instanceof HTMLElement) {
			element.hidden = !isLogin;
		}
	});
	portal.querySelectorAll('[data-auth-switch]').forEach((button) => {
		if (button instanceof HTMLElement) {
			button.setAttribute('aria-pressed', String(button.dataset.authSwitch === authMode));
		}
	});
}

/** Updates required/autocomplete states for dynamic auth inputs. */
function syncAuthModeInputs(controls: AuthModeControls, authMode: 'login' | 'register'): void {
	const isLogin = authMode === 'login';
	if (controls.email instanceof HTMLInputElement) {
		controls.email.placeholder = isLogin ? 'you@example.com' : 'you@company.com';
	}
	[controls.username, controls.confirmPassword, controls.termsConsent].forEach((field) => {
		if (field instanceof HTMLInputElement) {
			field.required = !isLogin;
		}
	});
	if (controls.emailVerificationConsent instanceof HTMLInputElement) {
		controls.emailVerificationConsent.required = !isLogin && authConfig.requireEmailVerification;
	}
	if (controls.password instanceof HTMLInputElement) {
		controls.password.setAttribute('autocomplete', isLogin ? 'current-password' : 'new-password');
		controls.password.placeholder = isLogin ? 'Your password' : '8+ chars, A–z, 0–9, symbol';
	}
}

/** Closes any active portal (native <dialog>). */
function closePortal(): void {
	const portal = queryElement('.portal', isHtmlElement);
	if (!portal) {
		return;
	}
	portalReleaseFocusTrap?.();
	portalReleaseFocusTrap = null;
	if (portal instanceof HTMLDialogElement && portal.open) {
		portal.close();
	}
	portal.remove();
	document.body.classList.remove('portal-open');
	announce('Workspace portal closed');
	portalPreviousFocus?.focus({ preventScroll: true });
	portalPreviousFocus = null;
}

/** Opens the generated portal as a native modal dialog. */
function openPortal(mode: PortalMode): void {
	closePortal();
	portalPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	insertTrustedHTML(document.body, 'beforeend', createPortalMarkup(mode));
	const portal = queryElement('.portal', isHtmlElement);
	if (!portal) {
		return;
	}
	bindPasswordToggles(portal);
	ensureButtonLabels();
	document.body.classList.add('portal-open');
	announce('Workspace portal opened');
	requestAnimationFrame(() => portal.classList.add('is-revealed'));
	portal.querySelector('[data-close-portal]')?.addEventListener('click', closePortal);
	// Native <dialog> handles ESC, focus management, inert background, and the
	// top layer for us. We still listen to the close event for symmetric cleanup.
	if (portal instanceof HTMLDialogElement) {
		portal.addEventListener('close', () => {
			document.body.classList.remove('portal-open');
			portalPreviousFocus?.focus({ preventScroll: true });
			portalPreviousFocus = null;
		}, { once: true });
		// Backdrop click closes the dialog.
		portal.addEventListener('click', (event) => {
			if (event.target === portal) {
				portal.close();
			}
		});
		try {
			portal.showModal();
		} catch {
			// Already open or not connected; nothing to do.
		}
	}
	const initialTermsConsent = portal.querySelector('#portal-terms-consent');
	const initialSubmitButton = portal.querySelector('.portal-cta');
	const authModeControls: AuthModeControls = {
		authTitle: portal.querySelector('[data-auth-title]'),
		authNote: portal.querySelector('[data-auth-note]'),
		submitButton: initialSubmitButton,
		termsConsent: initialTermsConsent,
		email: portal.querySelector('#portal-email'),
		username: portal.querySelector('#portal-username'),
		emailVerificationConsent: portal.querySelector('#portal-email-verification-consent'),
		password: portal.querySelector('#portal-password'),
		confirmPassword: portal.querySelector('#portal-password-confirm'),
	};
	const refreshPortalValidation = (): void => {
		const elements = portalFormElements(portal);
		if (elements) {
			updatePortalSubmitAvailability(portal, elements);
		}
	};
	let availabilityTimer: ReturnType<typeof setTimeout> | undefined;
	let availabilityRequest = 0;
	const scheduleAvailabilityCheck = (): void => {
		if (availabilityTimer !== undefined) {
			globalThis.clearTimeout(availabilityTimer);
		}
		const elements = portalFormElements(portal);
		if (!elements || portal.dataset.authMode !== 'register') {
			setPortalAvailabilityState(portal, 'email', 'unknown');
			setPortalAvailabilityState(portal, 'username', 'unknown');
			refreshPortalValidation();
			return;
		}
		const usernameState = elements.username ? usernameValidationState(elements.username) : { valid: true, message: '', state: 'idle' as FieldValidationState };
		if (elements.username && usernameState.state !== 'idle') {
			showInlineFieldMessage(elements.username, usernameState.message, usernameState.state);
		}
		if (!usernameState.valid || !hasValidEmailFormat(elements.email)) {
			setPortalAvailabilityState(portal, 'username', usernameState.valid ? 'unknown' : 'taken');
			setPortalAvailabilityState(portal, 'email', hasValidEmailFormat(elements.email) ? 'unknown' : 'taken');
			refreshPortalValidation();
			return;
		}
		setPortalAvailabilityState(portal, 'email', 'checking');
		setPortalAvailabilityState(portal, 'username', 'checking');
		showInlineFieldMessage(elements.email, 'Checking email availability…', 'warning');
		if (elements.username) {
			showInlineFieldMessage(elements.username, 'Checking username availability…', 'warning');
		}
		refreshPortalValidation();
		const requestId = ++availabilityRequest;
		availabilityTimer = globalThis.setTimeout(() => {
			void authClient.availability(elements.email.value, elements.username?.value ?? '').then((availability) => {
				if (requestId !== availabilityRequest || portal.dataset.authMode !== 'register') {
					return;
				}
				setPortalAvailabilityState(portal, 'email', availability.email.available === false ? 'taken' : 'available');
				setPortalAvailabilityState(portal, 'username', availability.username.available === false ? 'taken' : 'available');
				showAvailabilityResult(elements.email, availability.email);
				if (elements.username) {
					showAvailabilityResult(elements.username, availability.username);
				}
				refreshPortalValidation();
			}).catch(() => {
				if (requestId !== availabilityRequest) {
					return;
				}
				setPortalAvailabilityState(portal, 'email', 'unknown');
				setPortalAvailabilityState(portal, 'username', 'unknown');
				refreshPortalValidation();
			});
		}, 350);
	};
	const setAuthMode = (authMode: 'login' | 'register'): void => {
		portal.dataset.authMode = authMode;
		syncAuthModeCopy(authModeControls, authMode);
		syncAuthModeVisibility(portal, authMode);
		syncAuthModeInputs(authModeControls, authMode);
		scheduleAvailabilityCheck();
		refreshPortalValidation();
	};
	if (initialTermsConsent instanceof HTMLInputElement) {
		initialTermsConsent.addEventListener('change', () => {
			refreshPortalValidation();
			initialTermsConsent.removeAttribute('aria-invalid');
			initialTermsConsent.removeAttribute('aria-describedby');
		});
	}
	portal.querySelectorAll('[data-auth-switch]').forEach((button) => {
		if (button instanceof HTMLElement) {
			button.addEventListener('click', () => setAuthMode(button.dataset.authSwitch === 'login' ? 'login' : 'register'));
		}
	});
	bindEmailFieldValidation(portal);
	setAuthMode(mode === 'connect' ? 'login' : 'register');
	mountTurnstile(portal);
	const passwordField = portal.querySelector('[data-password-field]');
	const passwordInput = portal.querySelector('#portal-password');
	const forgotPassword = portal.querySelector('[data-forgot-password]');
	const recoveryActions = portal.querySelector('[data-recovery-actions]');
	const cancelRecovery = portal.querySelector('[data-cancel-recovery]');
	const closePortalButton = portal.querySelector('[data-close-portal]');
	[passwordInput, portal.querySelector('#portal-password-confirm')].forEach((field) => {
		if (field instanceof HTMLInputElement) {
			field.addEventListener('input', refreshPortalValidation);
		}
	});
	const setRecoveryMode = (enabled: boolean): void => {
		portal.dataset.portalMode = enabled ? 'recovery' : 'login';
		if (passwordField instanceof HTMLElement) {
			passwordField.hidden = enabled;
		}
		if (passwordInput instanceof HTMLInputElement) {
			passwordInput.required = !enabled;
			passwordInput.value = enabled ? '' : passwordInput.value;
		}
		if (initialSubmitButton instanceof HTMLButtonElement) {
			initialSubmitButton.hidden = enabled;
		}
		if (recoveryActions instanceof HTMLElement) {
			recoveryActions.hidden = !enabled;
		}
		if (closePortalButton instanceof HTMLElement) {
			closePortalButton.hidden = enabled;
		}
		portal.querySelectorAll('.portal-consent, .portal-register-only').forEach((element) => {
			if (element instanceof HTMLElement) {
				element.hidden = enabled || portal.dataset.authMode === 'login';
			}
		});
		portal.querySelectorAll('.portal-login-only').forEach((element) => {
			if (element instanceof HTMLElement) {
				element.hidden = enabled || portal.dataset.authMode === 'register';
			}
		});
		const error = portal.querySelector('.portal-error');
		if (error instanceof HTMLOutputElement) {
			error.textContent = '';
		}
		queryElement('#portal-email', isInput)?.focus();
		refreshPortalValidation();
	};
	if (forgotPassword instanceof HTMLButtonElement) {
		forgotPassword.addEventListener('click', () => setRecoveryMode(true));
	}
	if (cancelRecovery instanceof HTMLButtonElement) {
		cancelRecovery.addEventListener('click', () => setRecoveryMode(false));
	}
	portal.querySelector('.portal-login')?.addEventListener('submit', (event) => {
		event.preventDefault();
		const elements = portalFormElements(portal);
		if (!elements) {
			return;
		}
		void (portal.dataset.portalMode === 'recovery' ? submitPortalRecovery(portal, elements) : submitPortalLogin(portal, elements));
	});
	portal.querySelectorAll('input').forEach((field) => {
		field.addEventListener('input', () => {
			if (field instanceof HTMLInputElement && field.type === 'email') {
				scheduleAvailabilityCheck();
				refreshPortalValidation();
				return;
			}
			if (field instanceof HTMLInputElement && field.id === 'portal-username') {
				scheduleAvailabilityCheck();
			}
			if (field instanceof HTMLInputElement && field.validity.valid) {
				field.removeAttribute('aria-invalid');
				field.removeAttribute('aria-describedby');
			}
			refreshPortalValidation();
		});
	});
	refreshPortalValidation();
	queryElement('#portal-email', isInput)?.focus();
}


/** Installs newsletter opt-in form handlers. */
function bindNewsletterSignup(): void {
	queryElements('[data-newsletter-signup]', isHtmlElement).forEach((form) => {
		if (!(form instanceof HTMLFormElement)) {
			return;
		}
		bindEmailFieldValidation(form);
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			const email = form.elements.namedItem('email');
			const checkbox = form.elements.namedItem('newsletter_consent');
			const status = form.querySelector('[data-newsletter-status]');
			const button = form.querySelector('button[type="submit"]');
			if (!(email instanceof HTMLInputElement) || !(checkbox instanceof HTMLInputElement) || !(status instanceof HTMLOutputElement) || !(button instanceof HTMLButtonElement)) {
				return;
			}
			if (!validateEmailField(email, 'Please enter your email address')) {
				status.textContent = 'Please enter a valid email address (e.g. you@example.com)';
				email.focus();
				return;
			}
			if (!checkbox.checked) {
				status.textContent = 'Please tick the newsletter consent box to subscribe.';
				notifyWithMascot({
					kind: 'warning',
					title: 'Consent required',
					message: 'Please tick the newsletter consent box to subscribe.',
					duration: 5000,
				});
				checkbox.focus();
				return;
			}
			button.disabled = true;
			const previousText = button.textContent ?? 'Subscribe';
			button.textContent = 'Sending…';
			status.textContent = 'Sending your newsletter request…';
			setMountedMascotMood('listening', 1600);
			try {
				const response = await requestNewsletterSubscription(email.value);
				if (response.ok) {
					writeStorage(NEWSLETTER_INTENT_KEY, JSON.stringify({ email: email.value.trim(), pendingDoubleOptIn: true, policyVersion: POLICY_VERSION, savedAt: new Date().toISOString() }));
					status.textContent = response.message;
					notifyWithMascot({
						kind: 'success',
						title: 'Almost there!',
						message: response.message,
						duration: 0,
					});
					return;
				}
				throw new Error(response.message);
			} catch (error) {
				const message = error instanceof Error && error.message !== 'newsletter_failed' ? error.message : 'Could not send. Please try again or contact us directly.';
				status.textContent = message;
				notifyWithMascot({
					kind: 'error',
					title: 'Could not send',
					message,
					duration: 8000,
				});
			} finally {
				button.disabled = false;
				button.textContent = previousText;
			}
		});
	});
}


/** Moves keyboard focus to meaningful content when the skip link is used. */

/** Installs document-level interaction handlers. */
function bindInteractions(): void {
	bindSkipLinkFocus();
	bindEmailFieldValidation(document);
	bindConsentBanner();
	bindNewsletterSignup();
	bindDataRightsForm({ readStorage, writeStorage, callGdprRpc, csrfStorageKey: CSRF_STORAGE_KEY, policyVersion: POLICY_VERSION });
	queryElements('[data-open-portal]', isButton).forEach((button) => button.addEventListener('click', () => openPortal('start')));
	queryElements('[data-open-connect]', isButton).forEach((button) => button.addEventListener('click', () => openPortal('connect')));
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closePortal();
		}
	});
	window.addEventListener('resize', renderPaperGrain);
}

/** Loads seeded BaaS data into the frontend status card. */
async function mountBaasStatus(): Promise<void> {
	const root = queryElement('[data-baas-status]', isHtmlElement);
	if (!root) {
		return;
	}

	const state = root.querySelector('[data-baas-state]');
	const list = root.querySelector('[data-baas-users]');
	if (!(state instanceof HTMLElement) || !(list instanceof HTMLUListElement)) {
		return;
	}

	try {
		const users = await fetchSeededUsers(3);
		state.textContent = `Connected securely — loaded ${users.length} seeded users.`;
		list.replaceChildren(
			...users.map((user) => {
				const item = document.createElement('li');
				const name = document.createElement('strong');
				const email = document.createElement('span');
				name.textContent = user.username;
				email.textContent = user.email;
				item.append(name, email);
				return item;
			}),
		);
	} catch (error) {
		state.textContent = error instanceof Error ? error.message : 'Unable to reach the BaaS gateway.';
		list.replaceChildren();
	}
}


/** Runs a callback once the main thread is idle (keeps decorative work off the
 * critical path so it doesn't inflate Total Blocking Time). Falls back to a
 * short timeout where requestIdleCallback is unavailable. */
function whenIdle(fn: () => void): void {
	const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback;
	if (typeof ric === 'function') ric(fn, { timeout: 2000 });
	else window.setTimeout(fn, 200);
}

/** Starts all client-side page behavior. */
function init(): void {
	dismissAll();
	applyTheme(initialTheme());
	applyMotionPreference(readStorage(MOTION_KEY) === 'true');
	ensureButtonLabels();
	bindPasswordToggles();
	bindInteractions();
	bindThemeControls();
	bindLogoutControls(logoutSession, announce);
	bindScrollReveal();
	void mountBaasStatus();
	void rehydrateAndReflectAuth(rehydrateSession);
	// Purely decorative — mount after first paint so they never block interaction.
	whenIdle(() => {
		renderPaperGrain();
		mountMascot(() => openPortal('start'));
	});
}

// ---------- Scroll reveal ----------


init();
