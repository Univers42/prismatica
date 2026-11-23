import { authConfig } from '../lib/auth-config';
import { useAuth } from '../hooks/useAuth';
import { setMountedMascotMood, notifyWithMascot } from './mascot';
import { announce } from './theme';
import { showLoginCodeStep } from './portal-login-code';
import { showLoginApproveStep } from './portal-login-approve';
import { isTrustedOsionosRedirect } from '../lib/osionos-redirect';
import { setAccessToken } from './portal-session';
import {
	type PortalFormElements,
	readTurnstileToken,
	clearPortalFieldErrors,
	showPortalFieldError,
	portalRegistrationProfile,
	validateEmailField,
	validatePortalAuth,
} from './portal-validation';
import { resetTurnstile } from './portal-turnstile';

export const authClient = useAuth();
export const RECOVERY_SUBMIT_LABEL = 'Send reset link';

export function humanAuthMessage(message: string): string {
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

export function messageMentions(message: string, ...keywords: string[]): boolean {
	const lower = message.toLowerCase();
	return keywords.some((k) => lower.includes(k.toLowerCase()));
}

export function setPortalSubmitBusy(button: HTMLButtonElement | null, busy: boolean, isRegister: boolean): void {
	if (!button) return;
	button.disabled = busy;
	button.textContent = busy ? 'Please wait…' : isRegister ? 'Create workspace account' : 'Sign in';
}

export async function submitPortalResendVerification(portal: HTMLElement, elements: PortalFormElements): Promise<void> {
	const result = await authClient.resendVerification({ email: elements.email.value.trim(), turnstileToken: readTurnstileToken(portal) });
	resetTurnstile(portal);
	const succeeded = result.ok;
	elements.error.textContent = succeeded ? 'A new confirmation link is on its way. Check your inbox.' : humanAuthMessage(result.message);
	elements.error.removeAttribute('hidden');
	if (succeeded) elements.resendVerification?.setAttribute('hidden', '');
	notifyWithMascot({ kind: succeeded ? 'success' : 'error', title: succeeded ? 'Link sent' : 'Could not send a new link', message: elements.error.textContent });
}

export async function submitPortalRecovery(portal: HTMLElement, elements: PortalFormElements): Promise<void> {
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
		resetTurnstile(portal);
		setPortalSubmitBusy(elements.submitButton, false, false);
		if (elements.submitButton) elements.submitButton.textContent = RECOVERY_SUBMIT_LABEL;
	}
}

export async function processPortalRegistration(elements: PortalFormElements, turnstileToken: string, onClose: () => void = () => undefined): Promise<void> {
	const result = await authClient.register({ email: elements.email.value.trim(), password: elements.password.value, turnstileToken, profile: portalRegistrationProfile(elements) });
	const message = humanAuthMessage(result.message);
	if (result.ok) {
		if (result.accessToken) setAccessToken(result.accessToken);
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
		globalThis.setTimeout(() => onClose(), 1500);
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

export async function completePortalLogin(sessionToken: string | undefined, onClose: () => void = () => undefined): Promise<void> {
	if (sessionToken) setAccessToken(sessionToken);
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
	globalThis.setTimeout(() => onClose(), 1200);
}

export async function processPortalLogin(portal: HTMLElement, elements: PortalFormElements, turnstileToken: string, onClose: () => void = () => undefined): Promise<void> {
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
	await completePortalLogin(authenticated.accessToken, onClose);
}

export async function submitPortalLogin(portal: HTMLElement, elements: PortalFormElements, onClose: () => void = () => undefined): Promise<void> {
	const isRegister = portal.dataset.authMode === 'register';
	const turnstileToken = validatePortalAuth(portal, elements, isRegister);
	if (!turnstileToken) return;
	setPortalSubmitBusy(elements.submitButton, true, isRegister);
	try {
		if (isRegister) await processPortalRegistration(elements, turnstileToken, onClose);
		else await processPortalLogin(portal, elements, turnstileToken, onClose);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Authentication failed.';
		elements.error.textContent = humanAuthMessage(message);
		elements.error.removeAttribute('hidden');
		notifyWithMascot({ kind: 'error', title: 'Authentication error', message: elements.error.textContent });
	} finally {
		resetTurnstile(portal);
		setPortalSubmitBusy(elements.submitButton, false, portal.dataset.authMode === 'register');
	}
}