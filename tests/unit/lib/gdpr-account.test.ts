import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bindAccountPrivacy, exportFilename, DELETION_CONFIRMATION_PHRASE } from '../../../src/lib/gdpr-account';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function render(): void {
	document.body.innerHTML = `
		<section data-gdpr-account>
			<div data-gdpr-account-signed-out><button type="button">Sign in</button></div>
			<div data-gdpr-account-signed-in hidden>
				<button type="button" data-gdpr-export>Download my data</button>
				<button type="button" data-gdpr-withdraw-newsletter>Withdraw newsletter consent</button>
				<form data-gdpr-deletion-form>
					<input name="confirmation" />
					<button type="submit">Request account deletion</button>
				</form>
			</div>
			<output data-gdpr-account-status></output>
		</section>
	`;
}

const status = () => document.querySelector('[data-gdpr-account-status]')?.textContent ?? '';
const signedIn = () => document.querySelector<HTMLElement>('[data-gdpr-account-signed-in]')!;
const signedOut = () => document.querySelector<HTMLElement>('[data-gdpr-account-signed-out]')!;

describe('account privacy self-service', () => {
	let callGdprRpc: ReturnType<typeof vi.fn>;
	let downloadFile: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		render();
		callGdprRpc = vi.fn().mockResolvedValue({ ok: true, status: 200, data: {} });
		downloadFile = vi.fn();
	});

	const bind = (token: string | null = 'user-jwt') => bindAccountPrivacy({
		resolveAccessToken: vi.fn().mockResolvedValue(token),
		callGdprRpc,
		downloadFile,
		now: () => new Date('2026-10-28T12:00:00.000Z'),
	});

	it('shows only the sign-in prompt and calls nothing without a session', async () => {
		await bind(null);
		expect(signedIn().hidden).toBe(true);
		expect(signedOut().hidden).toBe(false);
		expect(callGdprRpc).not.toHaveBeenCalled();
	});

	it('shows the self-service actions with a session', async () => {
		await bind();
		expect(signedIn().hidden).toBe(false);
		expect(signedOut().hidden).toBe(true);
	});

	it('downloads the export returned for the signed-in user as JSON', async () => {
		const exported = { data_subject: { user_id: 7, email: 'me@example.com' } };
		callGdprRpc.mockResolvedValue({ ok: true, status: 200, data: exported });
		await bind();
		document.querySelector<HTMLButtonElement>('[data-gdpr-export]')!.click();
		await flush();
		expect(callGdprRpc).toHaveBeenCalledWith('gdpr_export_my_data', {}, 'user-jwt');
		expect(downloadFile).toHaveBeenCalledWith('prismatica-data-export-2026-10-28.json', expect.any(String), 'application/json');
		expect(JSON.parse(downloadFile.mock.calls[0][1] as string)).toEqual(exported);
		expect(status()).toContain('downloaded');
	});

	it('asks to sign in again when the session expired during export', async () => {
		callGdprRpc.mockResolvedValue({ ok: false, status: 401 });
		await bind();
		document.querySelector<HTMLButtonElement>('[data-gdpr-export]')!.click();
		await flush();
		expect(downloadFile).not.toHaveBeenCalled();
		expect(status()).toContain('Sign in again');
	});

	it('withdraws newsletter consent for the signed-in user', async () => {
		await bind();
		document.querySelector<HTMLButtonElement>('[data-gdpr-withdraw-newsletter]')!.click();
		await flush();
		expect(callGdprRpc).toHaveBeenCalledWith('gdpr_withdraw_consent', { consent_type: 'newsletter' }, 'user-jwt');
		expect(status()).toContain('withdrawn');
	});

	it('does not request deletion until the confirmation phrase is typed', async () => {
		await bind();
		const form = document.querySelector<HTMLFormElement>('[data-gdpr-deletion-form]')!;
		(form.elements.namedItem('confirmation') as HTMLInputElement).value = 'delete';
		form.dispatchEvent(new Event('submit', { cancelable: true }));
		await flush();
		expect(callGdprRpc).not.toHaveBeenCalled();
		expect(status()).toContain(DELETION_CONFIRMATION_PHRASE);
	});

	it('requests deletion once confirmed and reports the erasure deadline', async () => {
		callGdprRpc.mockResolvedValue({ ok: true, status: 200, data: { status: 'received', expected_deletion_at: '2026-11-27T12:00:00.000Z' } });
		await bind();
		const form = document.querySelector<HTMLFormElement>('[data-gdpr-deletion-form]')!;
		(form.elements.namedItem('confirmation') as HTMLInputElement).value = DELETION_CONFIRMATION_PHRASE;
		form.dispatchEvent(new Event('submit', { cancelable: true }));
		await flush();
		expect(callGdprRpc).toHaveBeenCalledWith('gdpr_request_deletion', {}, 'user-jwt');
		expect(status()).toContain('Deletion request recorded');
		expect(status()).toContain('2026');
		expect(form.querySelector<HTMLButtonElement>('button[type="submit"]')!.hidden).toBe(true);
	});

	it('runs one action at a time', async () => {
		let resolve!: (value: unknown) => void;
		callGdprRpc.mockReturnValue(new Promise((done) => { resolve = done; }));
		await bind();
		const button = document.querySelector<HTMLButtonElement>('[data-gdpr-withdraw-newsletter]')!;
		button.click();
		await flush();
		button.click();
		await flush();
		expect(callGdprRpc).toHaveBeenCalledTimes(1);
		resolve({ ok: true, status: 200 });
		await flush();
		expect(button.disabled).toBe(false);
	});

	it('names exports by UTC date', () => {
		expect(exportFilename(new Date('2026-01-02T23:59:00.000Z'))).toBe('prismatica-data-export-2026-01-02.json');
	});
});
