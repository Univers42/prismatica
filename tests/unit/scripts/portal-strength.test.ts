import { describe, expect, it } from 'vitest';
import {
	STRENGTH_LABELS,
	renderPasswordStrength,
	syncPasswordMatchStatus,
	syncPortalPasswordFeedback,
} from '../../../src/scripts/portal-strength';
import type { PortalFormElements } from '../../../src/scripts/portal-validation';

describe('portal-strength module', () => {
	it('exports descriptive human labels for each strength level', () => {
		expect(STRENGTH_LABELS.empty).toBe('Enter a strong password');
		expect(STRENGTH_LABELS.weak).toContain('Weak');
		expect(STRENGTH_LABELS.fair).toContain('Fair');
		expect(STRENGTH_LABELS.good).toBe('Good password');
		expect(STRENGTH_LABELS.strong).toBe('Strong password');
	});

	it('renders password strength meter into container when elements exist', () => {
		const root = document.createElement('div');
		const input = document.createElement('input');
		input.id = 'portal-password';
		input.value = 'StrongP@ssw0rd123!';
		const container = document.createElement('div');
		container.setAttribute('data-password-strength-container', '');
		root.appendChild(input);
		root.appendChild(container);

		renderPasswordStrength(root);

		const meter = container.querySelector('.password-meter');
		expect(meter).not.toBeNull();
		expect(meter?.getAttribute('data-score')).toBe('4');
		const bar = container.querySelector('.password-meter__bar');
		expect(bar?.getAttribute('style')).toContain('width: 100%');
		const label = container.querySelector('.password-meter__label');
		expect(label?.textContent).toBe(STRENGTH_LABELS.strong);
	});

	it('no-ops safely when strength container or password input is missing', () => {
		const root = document.createElement('div');
		expect(() => renderPasswordStrength(root)).not.toThrow();
	});

	it('syncs password match status for empty, matching, and mismatched inputs', () => {
		const field = document.createElement('div');
		const confirm = document.createElement('input');
		confirm.id = 'portal-confirm-password';
		field.appendChild(confirm);
		const msg = document.createElement('p');
		msg.id = 'portal-confirm-password-inline-error';
		field.appendChild(msg);
		document.body.appendChild(field);

		// Null confirm input no-ops safely
		expect(() => syncPasswordMatchStatus(true, null)).not.toThrow();

		// Empty confirm input clears invalid state and sets idle text
		confirm.value = '';
		syncPasswordMatchStatus(false, confirm);
		const errorEl = document.getElementById('portal-confirm-password-inline-error');
		expect(errorEl?.textContent).toBe('Passwords must match.');
		expect(confirm.getAttribute('aria-invalid')).toBeNull();

		// Matching confirmation
		confirm.value = 'secret';
		syncPasswordMatchStatus(true, confirm);
		expect(errorEl?.dataset.validationState).toBe('valid');
		expect(errorEl?.textContent).toBe('Passwords match.');

		// Mismatch confirmation
		syncPasswordMatchStatus(false, confirm);
		expect(confirm.getAttribute('aria-invalid')).toBe('true');
		expect(errorEl?.textContent).toBe('Passwords do not match.');

		document.body.removeChild(field);
	});

	it('evaluates syncPortalPasswordFeedback for login vs register mode', () => {
		const portal = document.createElement('div');
		const form = document.createElement('form');
		const password = document.createElement('input');
		password.id = 'portal-password';
		const confirmPassword = document.createElement('input');
		confirmPassword.id = 'portal-confirm-password';
		const container = document.createElement('div');
		container.setAttribute('data-password-strength-container', '');
		portal.appendChild(container);
		portal.appendChild(password);
		portal.appendChild(confirmPassword);

		const mockElements = {
			form,
			password,
			confirmPassword,
		} as unknown as PortalFormElements;

		// Login mode (dataset.authMode !== 'register')
		portal.dataset.authMode = 'login';
		password.value = '';
		expect(syncPortalPasswordFeedback(portal, mockElements)).toBe(false);
		password.value = 'any';
		expect(syncPortalPasswordFeedback(portal, mockElements)).toBe(true);

		// Register mode: requires score >= 2 AND match
		portal.dataset.authMode = 'register';
		password.value = 'short';
		confirmPassword.value = 'short';
		expect(syncPortalPasswordFeedback(portal, mockElements)).toBe(false);

		password.value = 'SecureP@ss1234';
		confirmPassword.value = 'DifferentPass';
		expect(syncPortalPasswordFeedback(portal, mockElements)).toBe(false);

		confirmPassword.value = 'SecureP@ss1234';
		expect(syncPortalPasswordFeedback(portal, mockElements)).toBe(true);
	});
});