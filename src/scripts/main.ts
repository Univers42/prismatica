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

import { bindSkipLinkFocus } from "../lib/a11y";
import { bindScrollReveal } from "../lib/scroll-reveal";
import { rehydrateAndReflectAuth, bindLogoutControls } from "../lib/auth-ui";
import { bindGdprSelfService } from "../lib/gdpr-form";
import { baasConfig } from "../lib/baas-config";
import { readStorage, writeStorage } from '../lib/storage';
import { DATA_CONTROLLER, NEWSLETTER_INTENT_KEY, POLICY_VERSION } from '../data/legal';
import { dismissAll } from "./notifications";
import { fetchSeededUsers } from "../lib/baas-client";
import { queryElement, queryElements, isButton, isHtmlElement, isInput } from "../lib/dom-utils";
import "./premium";
import { initialTheme, applyTheme, applyMotionPreference, bindThemeControls, announce, ensureButtonLabels, MOTION_KEY } from "./theme";
import { initialLocale, applyLocale, bindLanguageControls } from "./language";
import { bindConsentBanner } from "./consent";
import { mountMascot, setMountedMascotMood, notifyWithMascot } from "./mascot";
import { openPortal, closePortal, bindPasswordToggles, bindEmailFieldValidation, validateEmailField, clearAccessToken, getAccessToken, mountTurnstile, readTurnstileToken } from "./portal";

/** Renders subtle noise over paper containers for hand-drawn grain. */
function renderPaperGrain(): void {
	queryElements('[data-paper-grain]', isHtmlElement).forEach((container) => {
		if (container.dataset.grainRendered === 'true') return;
		const canvas = document.createElement('canvas');
		canvas.className = 'paper-grain-overlay';
		canvas.setAttribute('aria-hidden', 'true');
		container.appendChild(canvas);
		container.dataset.grainRendered = 'true';
	});
}

async function requestNewsletterSubscription(email: string, turnstileToken: string): Promise<{ ok: boolean; message: string }> {
	const response = await fetch('/api/newsletter/subscribe', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, turnstileToken }),
	});
	const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
	if (!response.ok) {
		throw new Error(data.error ?? data.message ?? 'newsletter_failed');
	}
	return { ok: true, message: data.message ?? 'Subscription confirmed!' };
}

/**
 * Calls the GDPR service routes exposed by Grobase's authenticated Kong gateway.
 * These are HTTP endpoints, not Postgres RPCs. Never call them without the
 * current user's bearer token, and never use a service-role credential in the browser.
 */
async function callGdprEndpoint(
	path: string,
	method: 'GET' | 'POST' | 'DELETE',
	body?: Record<string, unknown>,
	token = getAccessToken(),
): Promise<{ ok: boolean; data?: unknown }> {
	if (!token) return { ok: false };
	try {
		const response = await fetch(`${baasConfig.url}${path}`, {
			method,
			headers: {
				apikey: baasConfig.anonKey,
				Authorization: `Bearer ${token}`,
				...(body ? { 'Content-Type': 'application/json' } : {}),
			},
			...(body ? { body: JSON.stringify(body) } : {}),
		});
		const contentType = response.headers.get('content-type') ?? '';
		const data: unknown = contentType.includes('application/json')
			? await response.json().catch(() => undefined)
			: response.ok
				? await response.blob()
				: await response.text().catch(() => undefined);
		return { ok: response.ok, data };
	} catch {
		return { ok: false };
	}
}

async function logoutSession(): Promise<void> {
	clearAccessToken();
	announce('Logged out successfully');
}

async function rehydrateSession(): Promise<boolean> {
	return Boolean(getAccessToken());
}

/** Installs document-level interaction handlers. */
function bindInteractions(): void {
	bindSkipLinkFocus();
	bindEmailFieldValidation(document);
	bindConsentBanner();
	bindNewsletterSignup();
	bindDataRightsForm({ readStorage, writeStorage, csrfStorageKey: CSRF_STORAGE_KEY, policyVersion: POLICY_VERSION, privacyContact: DATA_CONTROLLER.email });
	bindGdprSelfService({ callGdprEndpoint });
	queryElements('[data-open-portal]', isButton).forEach((button) => button.addEventListener('click', () => openPortal('start')));
	queryElements('[data-open-connect]', isButton).forEach((button) => button.addEventListener('click', () => openPortal('connect')));
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') closePortal();
	});
	window.addEventListener('resize', renderPaperGrain);
}

/** Loads seeded BaaS data into the frontend status card. */
async function mountBaasStatus(): Promise<void> {
	const root = queryElement('[data-baas-status]', isHtmlElement);
	if (!root) return;
	const state = root.querySelector('[data-baas-state]');
	const list = root.querySelector('[data-baas-users]');
	if (!(state instanceof HTMLElement) || !(list instanceof HTMLUListElement)) return;
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

/** Installs newsletter opt-in form handlers. */
function bindNewsletterSignup(): void {
	queryElements('[data-newsletter-signup]', isHtmlElement).forEach((form) => {
		if (!(form instanceof HTMLFormElement)) return;
		bindEmailFieldValidation(form);
		mountTurnstile(form);
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
				notifyWithMascot({ kind: 'warning', title: 'Consent required', message: 'Please tick the newsletter consent box to subscribe.', duration: 5000 });
				checkbox.focus();
				return;
			}
			button.disabled = true;
			const previousText = button.textContent ?? 'Subscribe';
			button.textContent = 'Sending…';
			status.textContent = 'Sending your newsletter request…';
			setMountedMascotMood('listening', 1600);
			try {
				const response = await requestNewsletterSubscription(email.value, readTurnstileToken(form));
				if (response.ok) {
					writeStorage(NEWSLETTER_INTENT_KEY, JSON.stringify({ email: email.value.trim(), pendingDoubleOptIn: true, policyVersion: POLICY_VERSION, savedAt: new Date().toISOString() }));
					status.textContent = response.message;
					notifyWithMascot({ kind: 'success', title: 'Almost there!', message: response.message, duration: 0 });
					return;
				}
				throw new Error(response.message);
			} catch (error) {
				const message = error instanceof Error && error.message !== 'newsletter_failed' ? error.message : 'Could not send. Please try again or contact us directly.';
				status.textContent = message;
				notifyWithMascot({ kind: 'error', title: 'Could not send', message, duration: 8000 });
			} finally {
				button.disabled = false;
				button.textContent = previousText;
			}
		});
	});
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
	applyLocale(initialLocale());
	bindLanguageControls();
	bindLogoutControls(logoutSession, announce);
	bindScrollReveal();
	void mountBaasStatus();
	void rehydrateAndReflectAuth(rehydrateSession);
	whenIdle(() => {
		renderPaperGrain();
		mountMascot(() => openPortal('start'));
	});
}


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

init();