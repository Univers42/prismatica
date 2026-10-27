// Markup for the sign-in / create-account dialog. Built as a string because
// the dialog is created on demand from any page (scripts/portal.ts inserts it
// through the Trusted Types policy). Every id, name and data-* hook here is
// what portal.ts and its tests look up — restyle freely, rename nothing.

import { authConfig } from '../lib/auth-config';
import { APP_GLYPH_PATHS } from '../data/app-glyphs';
import { loginApproveMarkup } from './portal-login-approve';
import { loginCodeMarkup } from './portal-login-code';
import { oauthMarkup } from './portal-oauth';
import type { PortalMode } from './portal';

// Mirrors components/brand/PrismaticaLogo.astro (decorative variant).
const LOGO = `<svg class="prismatica-logo" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false"><path d="M14.4 16c.9-.78 2.3-.78 3.2 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="11" cy="16" r="8" stroke="currentColor" stroke-width="1.65"/><circle cx="21" cy="16" r="8" stroke="currentColor" stroke-width="1.65"/><circle cx="11" cy="16" r="3" fill="var(--prismatica-logo-left)"/><circle cx="21" cy="16" r="3" fill="var(--prismatica-logo-right)"/></svg>`;

const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';

// One SVG; the slash shows once the password is visible (aria-pressed="true").
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><path class="portal-eye__slash" d="M4 20L20 4"/></svg>';

const TICK = '<span class="portal-check" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="M3.5 8.5l3 3 6-7"/></svg></span>';

// Six apps around one account: the dialog's side panel on wide screens.
function orbitMarkup(): string {
	const apps = Object.keys(APP_GLYPH_PATHS) as (keyof typeof APP_GLYPH_PATHS)[];
	const nodes = apps.map((app, index) => {
		const angle = (-90 + index * 60) * (Math.PI / 180);
		const x = (160 + Math.cos(angle) * 112).toFixed(1);
		const y = (160 + Math.sin(angle) * 112).toFixed(1);
		const glyph = APP_GLYPH_PATHS[app].map((d) => `<path d="${d}"/>`).join('');
		return {
			wire: `<path class="portal-orbit__wire" d="M${x} ${y}L160 160"/><path class="portal-orbit__flow portal-orbit__flow--${index}" d="M${x} ${y}L160 160" pathLength="1"/>`,
			node: `<g class="portal-orbit__node" transform="translate(${x} ${y})"><rect x="-23" y="-23" width="46" height="46" rx="13"/><g class="portal-orbit__glyph" transform="translate(-11 -11) scale(0.917)">${glyph}</g></g>`,
		};
	});
	return `
		<svg class="portal-orbit" viewBox="0 0 320 320" focusable="false">
			<circle class="portal-orbit__ring" cx="160" cy="160" r="112"/>
			<circle class="portal-orbit__ring portal-orbit__ring--far" cx="160" cy="160" r="150"/>
			${nodes.map((node) => node.wire).join('')}
			${nodes.map((node) => node.node).join('')}
			<circle class="portal-orbit__halo" cx="160" cy="160" r="40"/>
			<circle class="portal-orbit__core" cx="160" cy="160" r="34"/>
			<g transform="translate(140 140) scale(1.25)">${LOGO.replace('class="prismatica-logo"', 'class="portal-orbit__logo" width="32" height="32"')}</g>
		</svg>`;
}

export function createPortalMarkup(mode: PortalMode): string {
	const quick = mode === 'connect';
	const requiresEmailVerification = authConfig.requireEmailVerification;
	const registerNote = requiresEmailVerification
		? 'Create an account with email verification before opening your workspace.'
		: 'Create a local development account and open your workspace.';
	return `
		<dialog id="portal" class="portal portal--${quick ? 'quick' : 'start'}" aria-labelledby="portal-title">
			<div class="portal__frame">
				<section class="portal__main" aria-label="Your account">
					<header class="portal__bar">
						<span class="portal-brand">${LOGO}<span>Prismatica</span></span>
						<button class="portal__close" type="button" aria-label="Close" data-close-portal>${CLOSE}</button>
					</header>
					<div class="portal-login-area">
						<h2 id="portal-title" class="portal__title" data-auth-title>${quick ? 'Open your workspace' : 'Create your workspace'}</h2>
						<p class="portal-note" data-auth-note>${quick ? 'Sign in to connect Prismatica with the osionos app.' : registerNote}</p>
						<div class="portal-auth-switch" role="group" aria-label="Account mode">
							<button class="portal-auth-switch__button" type="button" data-auth-switch="register" aria-pressed="${quick ? 'false' : 'true'}">Create account</button>
							<button class="portal-auth-switch__button" type="button" data-auth-switch="login" aria-pressed="${quick ? 'true' : 'false'}">Sign in</button>
						</div>
						<form class="portal-login" novalidate>
							${oauthMarkup()}
							<div class="field-row portal-register-identity">
								<div class="field field--half portal-register-only">
									<label for="portal-username">Username <span class="field__required" aria-hidden="true">*</span></label>
									<input id="portal-username" name="username" type="text" autocomplete="username" placeholder="prism-user" minlength="3" maxlength="32" required />
									<p id="portal-username-inline-error" class="field-validation-message" data-validation-state="idle" aria-live="polite">Choose a unique username.</p>
								</div>
								<div class="field field--half">
									<label for="portal-email">Email <span class="field__required" aria-hidden="true">*</span></label>
									<input id="portal-email" name="email" type="email" autocomplete="email" placeholder="you@company.com" required />
									<p id="portal-email-inline-error" class="field-validation-message" data-validation-state="idle" aria-live="polite">Work or personal email.</p>
								</div>
							</div>
							<div class="field">
								<div class="field__head">
									<label for="portal-password">Password <span class="field__required" aria-hidden="true">*</span></label>
									<button class="portal-link-action portal-forgot" type="button" data-portal-action="forgot-password">Forgot password?</button>
								</div>
								<div class="input-with-button">
									<input id="portal-password" name="password" type="password" autocomplete="current-password" placeholder="At least 8 characters" minlength="8" required />
									<button class="portal-eye" type="button" data-password-toggle aria-label="Show password" aria-pressed="false">${EYE}</button>
								</div>
								<p id="portal-password-inline-error" class="field-validation-message" data-validation-state="idle" aria-live="polite">Min 8 chars with upper, lower, and digit.</p>
								<div class="portal-register-only" data-password-strength-container></div>
							</div>
							<div class="field portal-register-only">
								<label for="portal-confirm-password">Confirm password <span class="field__required" aria-hidden="true">*</span></label>
								<div class="input-with-button">
									<input id="portal-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Type it again" minlength="8" required />
									<button class="portal-eye" type="button" data-password-toggle aria-label="Show password" aria-pressed="false">${EYE}</button>
								</div>
								<p id="portal-confirm-inline-error" class="field-validation-message" data-validation-state="idle" aria-live="polite">Passwords must match.</p>
							</div>
							<div class="portal-consents portal-register-only">
								<label class="checkbox-label" for="portal-terms-consent">
									<input id="portal-terms-consent" name="termsConsent" type="checkbox" required />${TICK}
									<span>I agree to the <a href="/legal/terms/" target="_blank" rel="noopener">Terms</a> and <a href="/legal/privacy-policy/" target="_blank" rel="noopener">Privacy Policy</a> <span class="field__required" aria-hidden="true">*</span></span>
								</label>
								<label class="checkbox-label${requiresEmailVerification ? '' : ' is-hidden'}" for="portal-email-verification-consent">
									<input id="portal-email-verification-consent" name="emailVerificationConsent" type="checkbox" ${requiresEmailVerification ? 'checked required' : ''} />${TICK}
									<span>Send me an email verification link to activate my workspace <span class="field__required" aria-hidden="true">*</span></span>
								</label>
								<label class="checkbox-label" for="portal-newsletter-consent">
									<input id="portal-newsletter-consent" name="newsletterConsent" type="checkbox" />${TICK}
									<span>Keep me updated on Prismatica product updates (optional)</span>
								</label>
							</div>
							<div class="portal-turnstile-wrapper" data-turnstile-slot>
								<input type="hidden" name="turnstileToken" data-turnstile-token />
							</div>
							<output class="portal-form-error" aria-live="assertive" role="alert" hidden></output>
							<button class="portal-link-action" type="button" data-resend-verification hidden>Send a new link</button>
							<button class="portal-cta" type="submit" data-auth-submit>${quick ? 'Sign in' : 'Create workspace account'}</button>
						</form>
						${loginCodeMarkup()}
						${loginApproveMarkup()}
					</div>
				</section>
				<aside class="portal__aside" aria-hidden="true">
					${orbitMarkup()}
					<p class="portal__aside-title">One account. Every app.</p>
					<p class="portal__aside-text">Pages, boards, mail and calendar open in the same workspace the moment you sign in.</p>
				</aside>
			</div>
		</dialog>
	`;
}
