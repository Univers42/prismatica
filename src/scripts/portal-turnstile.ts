import { authConfig } from '../lib/auth-config';
import { notifyWithMascot } from './mascot';
import { LOCAL_TURNSTILE_TOKEN, portalFormElements, updatePortalSubmitAvailability } from './portal-validation';

export type TurnstileApi = {
	render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void }) => string;
	reset?: (widgetId?: string) => void;
};

export function mountTurnstile(portal: HTMLElement): void {
	const container = portal.querySelector('[data-turnstile-slot]');
	if (!(container instanceof HTMLElement)) return;

	if (!authConfig.turnstileSiteKey) {
		const tokenInput = portal.querySelector('[data-turnstile-token]');
		if (tokenInput instanceof HTMLInputElement) {
			tokenInput.value = LOCAL_TURNSTILE_TOKEN;
		}
		return;
	}

	const render = (): void => {
		const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
		if (!turnstile) return;
		try {
			turnstile.render(container, {
				sitekey: authConfig.turnstileSiteKey,
				callback: (token: string) => {
					const tokenInput = portal.querySelector('[data-turnstile-token]');
					if (tokenInput instanceof HTMLInputElement) tokenInput.value = token;
					const form = portal.querySelector('form.portal-login');
					if (form instanceof HTMLFormElement) {
						const elements = portalFormElements(portal);
						if (elements) updatePortalSubmitAvailability(portal, elements);
					}
				},
				'error-callback': () => {
					notifyWithMascot({ kind: 'error', title: 'Verification error', message: 'Turnstile check failed. Please refresh.' });
				},
				'expired-callback': () => {
					const tokenInput = portal.querySelector('[data-turnstile-token]');
					if (tokenInput instanceof HTMLInputElement) tokenInput.value = '';
					const form = portal.querySelector('form.portal-login');
					if (form instanceof HTMLFormElement) {
						const elements = portalFormElements(portal);
						if (elements) updatePortalSubmitAvailability(portal, elements);
					}
				},
			});
		} catch {
			// Container already rendered or widget reset
		}
	};

	if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) {
		render();
	} else {
		const check = setInterval(() => {
			if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) {
				clearInterval(check);
				render();
			}
		}, 100);
		setTimeout(() => clearInterval(check), 10000);
	}
}