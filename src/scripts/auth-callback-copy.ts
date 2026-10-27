/* What the callback page says for each way a provider sign-in can stop: what happened, whether
   anything changed, and what to do next. Every line is fixed text; nothing from the URL or the
   gateway body is shown except the plain reference code. */

import type { CallbackProblem } from './auth-callback';
import type { AuthResult } from './auth-result';
import type { OAuthProvider } from './portal-oauth';

export type CallbackCopy = Required<Omit<AuthResult, 'code'>>;

const PROVIDER_NAMES: Record<OAuthProvider, string> = { google: 'Google', github: 'GitHub' };

type CopyBuilder = (provider: string) => CallbackCopy;

const COPY: Record<CallbackProblem, CopyBuilder> = {
	cancelled: (provider) => ({
		tone: 'notice',
		title: 'Sign-in cancelled',
		message: `The sign-in was stopped at ${provider}, or ${provider} did not share your account. Nothing was created or changed.`,
		steps: [`Try again and choose Continue or Allow when ${provider} asks.`, 'Or sign in with your email and password.'],
		action: 'Try again',
	}),
	email_in_use: (provider) => ({
		tone: 'notice',
		title: 'This email already has an account',
		message: `The email address ${provider} shared is already registered on Prismatica with a password. To protect that account, a new sign-in method is never attached to it automatically.`,
		steps: ['Sign in with your email and password.', 'Forgot your password? Choose “Forgot password” in the sign-in window to reset it.'],
		action: 'Sign in with email',
	}),
	email_unverified: (provider) => ({
		tone: 'notice',
		title: `Verify your email at ${provider} first`,
		message: `${provider} has not confirmed the email address on your account yet, so it cannot be used to create a Prismatica account.`,
		steps: [`Confirm your email address in your ${provider} account settings.`, 'Come back and sign in again.'],
		action: 'Try again',
	}),
	expired: () => ({
		tone: 'notice',
		title: 'This sign-in link has expired',
		message: 'A sign-in link works once, for 10 minutes, and only in the browser tab that started it. This one was already used, timed out, or was opened in another tab.',
		steps: ['Start again from the sign-in window, in this tab.', 'Keep this tab open until you are back on Prismatica.'],
		action: 'Start again',
	}),
	rate_limited: () => ({
		tone: 'notice',
		title: 'Too many attempts',
		message: 'Sign-in from this connection is paused for a moment to keep accounts safe.',
		steps: ['Wait about a minute.', 'Then try again.'],
		action: 'Try again',
	}),
	unavailable: (provider) => ({
		tone: 'notice',
		title: `Sign-in with ${provider} is unavailable`,
		message: `Sign-in with ${provider} is switched off right now. Your account is not affected.`,
		steps: ['Sign in with your email and password instead.', `Try ${provider} again later.`],
		action: 'Sign in with email',
	}),
	password_only: () => ({
		tone: 'notice',
		title: 'Use your password for this account',
		message: 'This account signs in with an email address and password only.',
		steps: ['Sign in with your email and password.'],
		action: 'Sign in with email',
	}),
	service_down: (provider) => ({
		tone: 'danger',
		title: 'The sign-in service did not answer',
		message: `${provider} let you through, but Prismatica could not finish the sign-in. No account was changed.`,
		steps: ['Check your internet connection.', 'Wait a minute, then try again.'],
		action: 'Try again',
	}),
	redirect_blocked: () => ({
		tone: 'danger',
		title: 'An unsafe redirect was blocked',
		message: 'The sign-in finished, but the address it pointed to is not the Prismatica workspace, so it was not opened.',
		steps: ['Try again.', 'If it happens again, contact support and quote the reference below.'],
		action: 'Try again',
	}),
	failed: (provider) => ({
		tone: 'danger',
		title: 'Sign-in did not finish',
		message: `Something went wrong between ${provider} and Prismatica. No account was changed.`,
		steps: ['Try again from the sign-in window.', 'If it keeps failing, sign in with your email and password, and quote the reference below to support.'],
		action: 'Try again',
	}),
};

export function callbackCopy(problem: CallbackProblem, provider: OAuthProvider | null): CallbackCopy {
	return COPY[problem](provider ? PROVIDER_NAMES[provider] : 'your provider');
}
