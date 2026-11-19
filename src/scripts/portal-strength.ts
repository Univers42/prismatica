import { checkPasswordStrength } from '../lib/auth-validation';
import { clearInlineFieldError, showInlineFieldError, type PortalFormElements } from './portal-validation';

export const STRENGTH_LABELS: Record<ReturnType<typeof checkPasswordStrength>['level'], string> = {
	empty: 'Enter a strong password',
	weak: 'Weak: add length, case, digits or a symbol',
	fair: 'Fair: one more rule makes it good',
	good: 'Good password',
	strong: 'Strong password',
};

export function renderPasswordStrength(root: ParentNode): void {
	const container = root.querySelector('[data-password-strength-container]');
	if (!container) return;
	const input = root.querySelector('#portal-password');
	if (!(input instanceof HTMLInputElement)) return;
	const strength = checkPasswordStrength(input.value);
	const meter = document.createElement('div');
	meter.className = 'password-meter';
	meter.dataset.score = String(strength.score);
	const bar = document.createElement('div');
	bar.className = 'password-meter__bar';
	bar.style.width = `${(strength.score / 4) * 100}%`;
	meter.append(bar);
	const label = document.createElement('span');
	label.className = 'password-meter__label';
	label.textContent = STRENGTH_LABELS[strength.level];
	container.replaceChildren(meter, label);
}

export function syncPasswordMatchStatus(match: boolean, confirmPassword: HTMLInputElement | null): void {
	if (!confirmPassword) return;
	const messageId = `${confirmPassword.id}-inline-error`;
	if (confirmPassword.value.length === 0) {
		clearInlineFieldError(confirmPassword, messageId, 'Passwords must match.');
		return;
	}
	if (match) {
		clearInlineFieldError(confirmPassword, messageId, 'Passwords match.');
		const msg = document.getElementById(messageId);
		if (msg) msg.dataset.validationState = 'valid';
	} else {
		showInlineFieldError(confirmPassword, messageId, 'Passwords do not match.');
	}
}

export function syncPortalPasswordFeedback(portal: HTMLElement, elements: PortalFormElements): boolean {
	const isRegister = portal.dataset.authMode === 'register';
	if (!isRegister) return elements.password.value.length > 0;
	renderPasswordStrength(portal);
	const strength = checkPasswordStrength(elements.password.value);
	const match = Boolean(elements.confirmPassword && elements.password.value === elements.confirmPassword.value);
	syncPasswordMatchStatus(match, elements.confirmPassword);
	return strength.score >= 2 && match;
}