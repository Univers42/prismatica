function formDataString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === 'string' ? value : '';
}

function generateSafeToken(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const ALLOWED_REQUEST_TYPES = new Set([
	'access',
	'deletion',
	'rectification',
	'portability',
	'restriction',
	'objection',
	'withdrawal',
]);

export interface GdprDependencies {
	readStorage: (key: string) => string | null;
	writeStorage: (key: string, val: string) => void;
	callGdprRpc: (method: string, payload: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown } | null>;
	callGdprEndpoint?: (path: string, method: 'GET' | 'POST' | 'DELETE', payload?: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown } | null>;
	csrfStorageKey: string;
	policyVersion: string;
}

export function bindDataRightsForm(deps: GdprDependencies): void {
	const form = document.querySelector<HTMLFormElement>('[data-gdpr-request-form]');
	if (!form) return;

	let csrf = deps.readStorage(deps.csrfStorageKey);
	if (!csrf) {
		csrf = generateSafeToken();
		deps.writeStorage(deps.csrfStorageKey, csrf);
	}

	const csrfInput = form.querySelector('[data-csrf-token]');
	if (csrfInput instanceof HTMLInputElement) csrfInput.value = csrf;

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		const status = form.querySelector('[data-gdpr-request-status]');
		const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
		const formData = new FormData(form);
		if (!(status instanceof HTMLOutputElement)) return;

		if (formData.get('csrf') !== csrf) {
			status.textContent = 'Security token mismatch. Refresh and try again.';
			return;
		}

		const requestType = formDataString(formData, 'request_type');
		const email = formDataString(formData, 'email').trim();
		const message = formDataString(formData, 'message').trim();
		if (!ALLOWED_REQUEST_TYPES.has(requestType)) {
			status.textContent = 'Choose a valid data-rights request type.';
			return;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			status.textContent = 'Enter a valid email address.';
			const emailInput = form.elements.namedItem('email');
			if (emailInput instanceof HTMLInputElement) emailInput.focus();
			return;
		}

		if (submitButton) submitButton.disabled = true;
		status.textContent = 'Submitting your request…';
		const response = await deps.callGdprRpc('gdpr_submit_request', {
			request_type: requestType,
			email,
			details: { message, csrf, policyVersion: deps.policyVersion },
		}).catch(() => null);
		status.textContent = response?.ok
			? 'Your request has been recorded. We may contact you to verify identity.'
			: 'Could not record the request right now. Please try again or contact the privacy address.';
		if (submitButton) submitButton.disabled = false;
	});
}

function setActionState(container: HTMLElement, message: string, busy = false): void {
	const status = container.querySelector('[data-gdpr-self-service-status]');
	if (status instanceof HTMLOutputElement) status.textContent = message;
	container.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = busy; });
}

function endpointCaller(deps: {
	callGdprRpc: (method: string, payload: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown } | null>;
	callGdprEndpoint?: (path: string, method: 'GET' | 'POST' | 'DELETE', payload?: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown } | null>;
}) {
	return deps.callGdprEndpoint ?? (async (path: string, method: 'GET' | 'POST' | 'DELETE', payload?: Record<string, unknown>) => {
		// The previous implementation incorrectly called SQL RPC names that do
		// not exist in Grobase. Do not silently fall back to a fake success.
		return { ok: false, data: { error: `No authenticated GDPR endpoint configured for ${method} ${path}` } };
	});
}

function downloadExport(data: unknown, filename = `prismatica-data-export-${new Date().toISOString().slice(0, 10)}.json'): void {
	if (data instanceof Blob) {
		const url = URL.createObjectURL(data);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
		anchor.hidden = true;
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 0);
		return;
	}

	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.hidden = true;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function bindGdprSelfService(deps: {
	callGdprRpc: (method: string, payload: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown } | null>;
	callGdprEndpoint?: (path: string, method: 'GET' | 'POST' | 'DELETE', payload?: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown } | null>;
}): void {
	const container = document.querySelector<HTMLElement>('[data-gdpr-self-service]');
	if (!container) return;

	const exportButton = container.querySelector<HTMLButtonElement>('[data-gdpr-export]');
	const deleteButton = container.querySelector<HTMLButtonElement>('[data-gdpr-delete]');

	exportButton?.addEventListener('click', async () => {
		setActionState(container, 'Preparing your export…', true);
		try {
			const callEndpoint = endpointCaller(deps);
			const response = await callEndpoint('/gdpr/export', 'GET');
			if (!response?.ok || response.data === undefined) {
				setActionState(container, 'Could not export your data. Sign in and try again, or contact the privacy address.');
				return;
			}
			downloadExport(response.data);
			setActionState(container, 'Your data export has been downloaded.');
		} catch {
			setActionState(container, 'Could not export your data. Sign in and try again, or contact the privacy address.');
		} finally {
			container.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = false; });
		}
	});

	deleteButton?.addEventListener('click', async () => {
		if (!window.confirm('Request deletion of your Prismatica account and associated personal data? This action may not be reversible.')) return;
		setActionState(container, 'Submitting account deletion request…', true);
		try {
			const callEndpoint = endpointCaller(deps);
			const response = await callEndpoint('/gdpr/deletion-requests', 'POST', {});
			setActionState(
				container,
				response?.ok
					? 'Account deletion request submitted. Follow any confirmation steps provided by the service.'
					: 'Could not submit deletion request. Sign in and try again, or contact the privacy address.',
			);
		} catch {
			setActionState(container, 'Could not submit deletion request. Sign in and try again, or contact the privacy address.');
		} finally {
			container.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = false; });
		}
	});
}
