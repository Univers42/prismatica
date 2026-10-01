function formDataString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === 'string' ? value : '';
}

function generateSafeToken(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	// Fallback for non-secure contexts where randomUUID is missing
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export interface GdprDependencies {
	readStorage: (key: string) => string | null;
	writeStorage: (key: string, val: string) => void;
	callGdprRpc: (method: string, payload: any) => Promise<{ ok: boolean } | null>;
	csrfStorageKey: string;
	policyVersion: string;
}

export function bindDataRightsForm(deps: GdprDependencies): void {
	const form = document.querySelector<HTMLFormElement>('[data-gdpr-request-form]');
	if (!form) {
		return;
	}
	
	let csrf = deps.readStorage(deps.csrfStorageKey);
	if (!csrf) {
		csrf = generateSafeToken();
		deps.writeStorage(deps.csrfStorageKey, csrf);
	}
	
	const csrfInput = form.querySelector('[data-csrf-token]');
	if (csrfInput instanceof HTMLInputElement) {
		csrfInput.value = csrf;
	}
	
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		const status = form.querySelector('[data-gdpr-request-status]');
		const formData = new FormData(form);
		if (!(status instanceof HTMLOutputElement)) {
			return;
		}
		if (formData.get('csrf') !== csrf) {
			status.textContent = 'Security token mismatch. Refresh and try again.';
			return;
		}
		const response = await deps.callGdprRpc('gdpr_submit_request', {
			request_type: formDataString(formData, 'request_type'),
			email: formDataString(formData, 'email'),
			details: { 
				message: formDataString(formData, 'message'), 
				csrf, 
				policyVersion: deps.policyVersion 
			},
		}).catch(() => null);
		status.textContent = response?.ok 
			? 'Your request has been recorded. We may contact you to verify identity.' 
			: 'Could not record the request right now.';
	});
}
