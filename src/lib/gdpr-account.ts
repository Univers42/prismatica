import type { GdprRpcCaller } from './gdpr-form';

/**
 * Self-service data rights for a signed-in user on the Data Rights page:
 * export (GDPR Art. 15 and 20), newsletter consent withdrawal (Art. 7(3))
 * and account erasure request (Art. 17). Every call runs as the user through
 * the RPCs granted to the `authenticated` role, so the database scopes the
 * data to the caller.
 */
export interface GdprAccountDependencies {
	/** Returns a fresh access token when the browser holds a session, otherwise null. */
	resolveAccessToken: () => Promise<string | null>;
	callGdprRpc: GdprRpcCaller;
	/** Hands a file to the browser; injected so tests do not touch object URLs. */
	downloadFile: (filename: string, contents: string, mimeType: string) => void;
	now?: () => Date;
}

export const DELETION_CONFIRMATION_PHRASE = 'DELETE';

export function exportFilename(now: Date): string {
	return `prismatica-data-export-${now.toISOString().slice(0, 10)}.json`;
}

function formatDate(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function rpcFailure(status: number | undefined, fallback: string): string {
	if (status === 401 || status === 403) return 'Your session has expired. Sign in again and retry.';
	if (status === 429) return 'Too many requests. Please wait a few minutes and try again.';
	return fallback;
}

export function browserDownload(filename: string, contents: string, mimeType: string): void {
	const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.rel = 'noopener';
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function bindAccountPrivacy(deps: GdprAccountDependencies): Promise<void> {
	const root = document.querySelector<HTMLElement>('[data-gdpr-account]');
	if (!root) return;

	const signedIn = root.querySelector<HTMLElement>('[data-gdpr-account-signed-in]');
	const signedOut = root.querySelector<HTMLElement>('[data-gdpr-account-signed-out]');
	const status = root.querySelector('[data-gdpr-account-status]');
	if (!signedIn || !signedOut || !(status instanceof HTMLOutputElement)) return;

	const now = deps.now ?? (() => new Date());
	let token = await deps.resolveAccessToken().catch(() => null);
	signedIn.hidden = !token;
	signedOut.hidden = Boolean(token);
	if (!token) return;

	const exportButton = root.querySelector<HTMLButtonElement>('[data-gdpr-export]');
	const withdrawButton = root.querySelector<HTMLButtonElement>('[data-gdpr-withdraw-newsletter]');
	const deletionForm = root.querySelector<HTMLFormElement>('[data-gdpr-deletion-form]');
	let busy = false;

	const run = async (button: HTMLButtonElement | null, action: () => Promise<void>): Promise<void> => {
		if (busy) return;
		busy = true;
		if (button) button.disabled = true;
		status.textContent = '';
		try {
			// Access tokens are short-lived: refresh before each action so a page left open still works.
			token = (await deps.resolveAccessToken().catch(() => null)) ?? token;
			await action();
		} finally {
			busy = false;
			if (button) button.disabled = false;
		}
	};

	exportButton?.addEventListener('click', () => void run(exportButton, async () => {
		const result = await deps.callGdprRpc('gdpr_export_my_data', {}, token).catch(() => null);
		if (!result?.ok || result.data === undefined || result.data === null) {
			status.textContent = rpcFailure(result?.status, 'Could not prepare your export right now. Please try again or use the request form below.');
			return;
		}
		deps.downloadFile(exportFilename(now()), `${JSON.stringify(result.data, null, 2)}\n`, 'application/json');
		status.textContent = 'Your data export has been downloaded as a JSON file.';
	}));

	withdrawButton?.addEventListener('click', () => void run(withdrawButton, async () => {
		const result = await deps.callGdprRpc('gdpr_withdraw_consent', { consent_type: 'newsletter' }, token).catch(() => null);
		status.textContent = result?.ok
			? 'Newsletter consent withdrawn. You will not receive any more release emails.'
			: rpcFailure(result?.status, 'Could not withdraw newsletter consent right now. Please try again.');
	}));

	deletionForm?.addEventListener('submit', (event) => {
		event.preventDefault();
		const submit = deletionForm.querySelector<HTMLButtonElement>('button[type="submit"]');
		const confirmation = deletionForm.elements.namedItem('confirmation');
		const typed = confirmation instanceof HTMLInputElement ? confirmation.value.trim() : '';
		if (typed !== DELETION_CONFIRMATION_PHRASE) {
			status.textContent = `Type ${DELETION_CONFIRMATION_PHRASE} to confirm the deletion request.`;
			if (confirmation instanceof HTMLInputElement) confirmation.focus();
			return;
		}
		void run(submit, async () => {
			const result = await deps.callGdprRpc('gdpr_request_deletion', {}, token).catch(() => null);
			if (!result?.ok) {
				status.textContent = rpcFailure(result?.status, 'Could not record the deletion request right now. Please try again or use the request form below.');
				return;
			}
			const payload = (result.data ?? {}) as Record<string, unknown>;
			const due = formatDate(payload.expected_deletion_at);
			status.textContent = due
				? `Deletion request recorded. Your account will be erased or anonymised by ${due}.`
				: 'Deletion request recorded. Your account will be erased or anonymised within one month.';
			if (confirmation instanceof HTMLInputElement) confirmation.value = '';
			if (submit) submit.hidden = true;
		});
	});
}
