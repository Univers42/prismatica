function formDataString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === 'string' ? value : '';
}

function generateSafeToken(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
		const values = new Uint8Array(32);
		crypto.getRandomValues(values);
		return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
	}
	throw new Error('A cryptographically secure random number generator is required to submit this request.');
}

export type GdprRpcResult = {
	ok: boolean;
	status: number;
	data?: unknown;
};

export type GdprRpcCaller = (method: string, payload: Record<string, unknown>, accessToken?: string | null) => Promise<GdprRpcResult | null>;

export interface GdprDependencies {
	readStorage: (key: string) => string | null;
	writeStorage: (key: string, val: string) => void;
	callGdprRpc: GdprRpcCaller;
	csrfStorageKey: string;
	policyVersion: string;
}

// Mirrors the allowlist enforced by the gdpr_submit_request RPC. Consent withdrawal is not
// a form request: it is done directly from the consent controls and the account section.
export const ALLOWED_REQUEST_TYPES: ReadonlySet<string> = new Set([
	'access',
	'deletion',
	'rectification',
	'portability',
	'restriction',
	'objection',
]);

export const MESSAGE_MAX_LENGTH = 1000;

function failureMessage(status: number | undefined): string {
	if (status === 429) return 'Too many requests were sent from this browser. Please wait a few minutes and try again.';
	if (status === 400 || status === 422) return 'The request was rejected as invalid. Check the fields and try again.';
	return 'Could not record the request right now. Please try again or contact the privacy address listed on this page.';
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function bindDataRightsForm(deps: GdprDependencies): void {
	const form = document.querySelector<HTMLFormElement>('[data-gdpr-request-form]');
	if (!form) return;

	const status = form.querySelector('[data-gdpr-request-status]');
	if (!(status instanceof HTMLOutputElement)) return;

	let csrf: string;
	try {
		csrf = deps.readStorage(deps.csrfStorageKey) ?? '';
		if (!csrf) {
			csrf = generateSafeToken();
			deps.writeStorage(deps.csrfStorageKey, csrf);
		}
	} catch {
		status.textContent = 'Secure request setup is unavailable in this browser. Open this page over HTTPS and try again.';
		const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
		if (submit) submit.disabled = true;
		return;
	}

	const csrfInput = form.querySelector('[data-csrf-token]');
	if (csrfInput instanceof HTMLInputElement) csrfInput.value = csrf;

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		status.textContent = '';

		const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
		const formData = new FormData(form);
		const submittedCsrf = formDataString(formData, 'csrf');
		const requestType = formDataString(formData, 'request_type');
		const email = formDataString(formData, 'email').trim();
		const message = formDataString(formData, 'message').trim();

		if (!csrf || submittedCsrf !== csrf) {
			status.textContent = 'Security token mismatch. Refresh and try again.';
			return;
		}
		if (!ALLOWED_REQUEST_TYPES.has(requestType)) {
			status.textContent = 'Choose a valid request type.';
			return;
		}
		if (!EMAIL_PATTERN.test(email) || email.length > 254) {
			status.textContent = 'Enter a valid email address.';
			form.querySelector<HTMLInputElement>('[name="email"]')?.focus();
			return;
		}
		if (message.length > MESSAGE_MAX_LENGTH) {
			status.textContent = 'Additional details must be 1,000 characters or fewer.';
			return;
		}
		if (submit?.disabled) return;

		if (submit) submit.disabled = true;
		try {
			const response = await deps.callGdprRpc('gdpr_submit_request', {
				request_type: requestType,
				email,
				details: {
					message,
					csrf,
					policyVersion: deps.policyVersion,
				},
			}).catch(() => null);

			if (response?.ok) {
				status.textContent = 'Your request has been recorded. We may contact you to verify your identity, and we answer within one month.';
				const messageField = form.elements.namedItem('message');
				if (messageField instanceof HTMLTextAreaElement || messageField instanceof HTMLInputElement) messageField.value = '';
			} else {
				status.textContent = failureMessage(response?.status);
			}
		} finally {
			if (submit) submit.disabled = false;
		}
	});
}
