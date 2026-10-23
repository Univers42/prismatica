// The show/hide button beside a password input, shared by the portal and /auth/reset-password.
import { isButton } from '../lib/dom-utils';

export function bindPasswordToggles(root: ParentNode = document): void {
	root.querySelectorAll('[data-password-toggle]').forEach((button) => {
		if (!isButton(button)) return;
		button.addEventListener('click', () => {
			const input = button.closest('.field')?.querySelector('input');
			if (!(input instanceof HTMLInputElement)) return;
			const isPassword = input.type === 'password';
			input.type = isPassword ? 'text' : 'password';
			button.setAttribute('aria-pressed', String(isPassword));
			button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
			button.title = isPassword ? 'Hide password' : 'Show password';
			const icon = button.querySelector('.header-icon--toggle');
			if (icon instanceof HTMLElement) icon.textContent = isPassword ? 'Hide' : 'Show';
		});
	});
}
