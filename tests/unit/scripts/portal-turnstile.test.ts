import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountTurnstile, type TurnstileApi } from '../../../src/scripts/portal-turnstile';
import { LOCAL_TURNSTILE_TOKEN } from '../../../src/scripts/portal-validation';

describe('portal-turnstile module', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		delete (window as unknown as { turnstile?: TurnstileApi }).turnstile;
		vi.restoreAllMocks();
	});

	it('no-ops safely when slot container is missing', () => {
		const portal = document.createElement('div');
		expect(() => mountTurnstile(portal)).not.toThrow();
	});

	it('assigns LOCAL_TURNSTILE_TOKEN when turnstileSiteKey is unconfigured', () => {
		const portal = document.createElement('div');
		const slot = document.createElement('div');
		slot.setAttribute('data-turnstile-slot', '');
		const token = document.createElement('input');
		token.setAttribute('data-turnstile-token', '');
		portal.appendChild(slot);
		portal.appendChild(token);
		document.body.appendChild(portal);

		mountTurnstile(portal);
		expect(token.value).toBe(LOCAL_TURNSTILE_TOKEN);
	});

	it('cleans up interval without crashing when portal disconnects from DOM', () => {
		const portal = document.createElement('div');
		const slot = document.createElement('div');
		slot.setAttribute('data-turnstile-slot', '');
		portal.appendChild(slot);
		document.body.appendChild(portal);

		// Disconnect portal immediately
		document.body.removeChild(portal);
		expect(() => mountTurnstile(portal)).not.toThrow();
	});
});