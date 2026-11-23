import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/lib/auth-config', async (importOriginal) => {
	const original = await importOriginal<typeof import('../../../src/lib/auth-config')>();
	return { ...original, authConfig: { ...original.authConfig, turnstileSiteKey: 'site-key' } };
});

import { mountTurnstile, resetTurnstile, type TurnstileApi } from '../../../src/scripts/portal-turnstile';

type TurnstileWindow = { turnstile?: TurnstileApi };

function mountedForm(): { form: HTMLElement; token: HTMLInputElement } {
	const form = document.createElement('div');
	const slot = document.createElement('div');
	slot.setAttribute('data-turnstile-slot', '');
	const token = document.createElement('input');
	token.setAttribute('data-turnstile-token', '');
	form.append(slot, token);
	document.body.appendChild(form);
	return { form, token };
}

describe('resetTurnstile', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		delete (window as unknown as TurnstileWindow).turnstile;
	});

	it('drops the spent token and asks the widget it rendered for a new one', () => {
		const reset = vi.fn();
		(window as unknown as TurnstileWindow).turnstile = {
			render: (_container, options) => {
				options.callback('token-1');
				return 'widget-7';
			},
			reset,
		};
		const { form, token } = mountedForm();
		mountTurnstile(form);
		expect(token.value).toBe('token-1');

		resetTurnstile(form);

		expect(token.value).toBe('');
		expect(reset).toHaveBeenCalledExactlyOnceWith('widget-7');
	});

	it('does nothing on a form whose widget never rendered', () => {
		const { form, token } = mountedForm();
		token.value = 'kept';
		expect(() => resetTurnstile(form)).not.toThrow();
		expect(token.value).toBe('kept');
	});
});
