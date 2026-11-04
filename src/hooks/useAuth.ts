/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   useAuth.ts                                         :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { authConfig } from '../lib/auth-config';
import type { SignedLink } from '../lib/auth-link';

const EMAIL_ATEXT = "A-Za-z0-9!#$%&'*+/=?^_`{|}~-";
const EMAIL_LOCAL_PART = String.raw`(?:[${EMAIL_ATEXT}]+(?:\.[${EMAIL_ATEXT}]+)*|"[^"\r\n]+")`;
const EMAIL_DOMAIN_LABEL = '(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)';
export const RFC_5322_EMAIL_REGEX = new RegExp(String.raw`^${EMAIL_LOCAL_PART}@(?:${EMAIL_DOMAIN_LABEL}\.)+[A-Za-z]{2,63}$`);
export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export type AuthMode = 'login' | 'register';

export type AuthRequest = {
	email: string;
	password: string;
	turnstileToken: string;
};

export type RegisterProfile = {
	username: string;
	confirmPassword: string;
	emailVerificationConsent?: boolean;
	newsletterConsent?: boolean;
	notificationsEnabled?: boolean;
};

export type RegisterRequest = AuthRequest & {
	profile: RegisterProfile;
};

export type RecoverRequest = {
	email: string;
	turnstileToken: string;
};

export type ResetPasswordRequest = { password: string; code?: string } & (SignedLink | { reset_ticket: string });

export type AuthResult = {
	ok: boolean;
	status: number;
	message: string;
	/** The gateway's machine-readable reason (`mfa_required`, `link_expired`, …). */
	code?: string;
	/** The email-approval machine state the gateway returns: 'email_approve' waits for a device
	 *  approval, 'email_otp' wants the 6-digit code from the mail (scripts/portal-login-*.ts). */
	mfaRequired?: string;
	/** The 2-digit number the waiting browser shows while the sign-in is approved elsewhere. */
	match?: number;
	pending?: boolean;
	accessToken?: string;
	expiresIn?: number;
	/** Continues a reset after `mfa_required` or a refused password (scripts/auth/link-flows.mjs). */
	resetTicket?: string;
};

export type OsionosBridgeResult = {
	ok: boolean;
	status: number;
	message: string;
	redirectUrl?: string;
	expiresIn?: number;
	workspaceId?: string;
};

type AuthClientOptions = {
	gatewayUrl?: string;
	maxRetries?: number;
};

function normalizeGatewayUrl(url: string): string {
	return url.replace(/\/$/, '');
}

export function validateEmail(email: string): boolean {
	return RFC_5322_EMAIL_REGEX.test(email.trim());
}

export function validatePassword(password: string): boolean {
	return STRONG_PASSWORD_REGEX.test(password);
}

function validationMessage(request: AuthRequest, mode: AuthMode): string | null {
	if (!validateEmail(request.email)) {
		return 'Use a valid email address.';
	}
	if (mode === 'register' && !validatePassword(request.password)) {
		return 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.';
	}
	if (mode === 'login' && request.password.length === 0) {
		return 'Enter your password.';
	}
	if (!request.turnstileToken) {
		return 'Complete the anti-abuse check.';
	}
	return null;
}

function registrationValidationMessage(request: RegisterRequest): string | null {
	const baseError = validationMessage(request, 'register');
	if (baseError) {
		return baseError;
	}
	if (!/^\w[\w.-]{2,31}$/.test(request.profile.username.trim())) {
		return 'Choose a username with 3–32 letters, numbers, dots, underscores, or hyphens.';
	}
	if (request.password !== request.profile.confirmPassword) {
		return 'Password confirmation must match.';
	}
	if (authConfig.requireEmailVerification && request.profile.emailVerificationConsent === false) {
		return 'Email verification must stay enabled for account security.';
	}
	return null;
}

async function delay(ms: number): Promise<void> {
	await new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function randomJitter(maxExclusive: number): number {
	const values = new Uint32Array(1);
	globalThis.crypto.getRandomValues(values);
	return (values[0] / 0x100000000) * maxExclusive;
}

async function parseAuthResponse(response: Response): Promise<AuthResult> {
	const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
	let message = 'Request failed.';
	if (typeof payload.error_description === 'string') {
		message = payload.error_description;
	} else if (typeof payload.msg === 'string') {
		message = payload.msg;
	} else if (typeof payload.message === 'string') {
		message = payload.message;
	} else if (typeof payload.error === 'string') {
		message = payload.error;
	} else if (response.ok) {
		message = 'Request completed.';
	}
	return {
		ok: response.ok,
		status: response.status,
		message,
		code: typeof payload.error === 'string' ? payload.error : undefined,
		mfaRequired: typeof payload.mfa_required === 'string' ? payload.mfa_required : undefined,
		match: typeof payload.match === 'number' ? payload.match : undefined,
		pending: payload.pending === true ? true : undefined,
		accessToken: typeof payload.access_token === 'string' ? payload.access_token : undefined,
		expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : undefined,
		resetTicket: typeof payload.reset_ticket === 'string' ? payload.reset_ticket : undefined,
	};
}

async function parseOsionosBridgeResponse(response: Response): Promise<OsionosBridgeResult> {
	const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
	const fallback = response.ok ? 'osionos bridge handoff is ready.' : 'Could not open the osionos workspace.';
	const message = [payload.message, payload.error_description, payload.msg, payload.error]
		.find((value) => typeof value === 'string' && value.trim().length > 0);
	return {
		ok: response.ok,
		status: response.status,
		message: typeof message === 'string' ? message : fallback,
		redirectUrl: typeof payload.redirectUrl === 'string' ? payload.redirectUrl : undefined,
		expiresIn: typeof payload.expiresIn === 'number' ? payload.expiresIn : undefined,
		workspaceId: typeof payload.workspaceId === 'string' ? payload.workspaceId : undefined,
	};
}

function accountMailRequestMessage(request: RecoverRequest): string | null {
	if (!validateEmail(request.email)) return 'Use a valid email address.';
	if (!request.turnstileToken) return 'Complete the anti-abuse check.';
	return null;
}

async function fetchWithBackoff(url: string, init: RequestInit, maxRetries: number): Promise<Response> {
	let attempt = 0;
	for (;;) {
		const response = await fetch(url, init);
		if (response.status !== 429 || attempt >= maxRetries) {
			return response;
		}
		const retryAfter = Number(response.headers.get('retry-after'));
		const baseDelay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt;
		await delay(Math.min(baseDelay + randomJitter(150), 5000));
		attempt += 1;
	}
}

export function useAuth(options: AuthClientOptions = {}) {
	const gatewayUrl = normalizeGatewayUrl(options.gatewayUrl ?? authConfig.gatewayUrl);
	const maxRetries = options.maxRetries ?? 3;
	const post = async (path: string, body: Record<string, unknown>): Promise<Response> => fetchWithBackoff(`${gatewayUrl}${path}`, {
		method: 'POST',
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(body),
	}, maxRetries);

	return {
		validateEmail,
		validatePassword,
		async signIn(request: AuthRequest): Promise<AuthResult> {
			const error = validationMessage(request, 'login');
			if (error) {
				return { ok: false, status: 422, message: error };
			}
			return parseAuthResponse(await post('/login', request));
		},
		async verifyLoginCode(code: string): Promise<AuthResult> {
			if (!/^\d{6}$/.test(code)) {
				return { ok: false, status: 422, message: 'Enter the 6-digit code from your email.' };
			}
			return parseAuthResponse(await post('/mfa/email/verify', { code }));
		},
		async pollLoginApproval(): Promise<AuthResult> {
			return parseAuthResponse(await post('/mfa/email/status', {}));
		},
		async resendLoginCode(): Promise<AuthResult> {
			return parseAuthResponse(await post('/mfa/email/resend', {}));
		},
		async register(request: RegisterRequest): Promise<AuthResult> {
			const error = registrationValidationMessage(request);
			if (error) {
				return { ok: false, status: 422, message: error };
			}
			return parseAuthResponse(await post('/register', request));
		},
		async recover(request: RecoverRequest): Promise<AuthResult> {
			const error = accountMailRequestMessage(request);
			return error ? { ok: false, status: 422, message: error } : parseAuthResponse(await post('/recover', request));
		},
		async resendVerification(request: RecoverRequest): Promise<AuthResult> {
			const error = accountMailRequestMessage(request);
			return error ? { ok: false, status: 422, message: error } : parseAuthResponse(await post('/resend-verification', request));
		},
		async verifyEmail(link: SignedLink): Promise<AuthResult> {
			return parseAuthResponse(await post('/verify', link));
		},
		async resetPassword(request: ResetPasswordRequest): Promise<AuthResult> {
			return parseAuthResponse(await post('/reset-password', request));
		},
		async refresh(): Promise<AuthResult> {
			return parseAuthResponse(await post('/refresh', {}));
		},
		async logout(): Promise<AuthResult> {
			return parseAuthResponse(await post('/logout', {}));
		},
		async osionosSession(accessToken: string): Promise<OsionosBridgeResult> {
			if (!accessToken) {
				return { ok: false, status: 401, message: 'Missing Prismatica session token.' };
			}
			return parseOsionosBridgeResponse(await fetchWithBackoff(`${gatewayUrl}/osionos-session`, {
				method: 'POST',
				headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
				credentials: 'include',
			}, maxRetries));
		},
		async beginMfaTotpEnrollment(): Promise<AuthResult> {
			return parseAuthResponse(await post('/mfa/totp/enroll', {}));
		},
		async verifyMfaTotp(code: string): Promise<AuthResult> {
			return parseAuthResponse(await post('/mfa/totp/verify', { code }));
		},
		async beginWebAuthn(): Promise<AuthResult> {
			return parseAuthResponse(await post('/mfa/webauthn/options', {}));
		},
	};
}
