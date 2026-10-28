import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bindGdprSelfService } from '../../../src/lib/gdpr-form';

describe('GDPR authenticated self-service actions', () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<section data-gdpr-self-service>
				<button type="button" data-gdpr-export>Export my data</button>
				<button type="button" data-gdpr-delete>Request deletion</button>
				<output data-gdpr-self-service-status></output>
			</section>
		`;
		vi.spyOn(window, 'confirm').mockReturnValue(true);
	});

	it('downloads a data export returned by the Grobase endpoint', async () => {
		const payload = { exportedAt: '2026-10-28T00:00:00.000Z', userId: 'user-1', data: { preferences: { theme: 'dark' } } };
		const endpoint = vi.fn().mockResolvedValue({ ok: true, data: payload });
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
		bindGdprSelfService({ callGdprEndpoint: endpoint });

		(document.querySelector('[data-gdpr-export]') as HTMLButtonElement).click();
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(endpoint).toHaveBeenCalledWith('/gdpr/v1/export', 'GET');
		expect(click).toHaveBeenCalledOnce();
		expect(revoke).toHaveBeenCalledOnce();
		expect(document.querySelector('[data-gdpr-self-service-status]')?.textContent).toContain('downloaded');
	});

	it('confirms before submitting a deletion request to Grobase', async () => {
		const endpoint = vi.fn().mockResolvedValue({ ok: true, data: { id: 1, status: 'pending' } });
		bindGdprSelfService({ callGdprEndpoint: endpoint });

		(document.querySelector('[data-gdpr-delete]') as HTMLButtonElement).click();
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(window.confirm).toHaveBeenCalledOnce();
		expect(endpoint).toHaveBeenCalledWith('/gdpr/v1/deletion-requests', 'POST', {});
		expect(document.querySelector('[data-gdpr-self-service-status]')?.textContent).toContain('submitted');
	});

	it('does not request deletion when confirmation is cancelled', () => {
		vi.spyOn(window, 'confirm').mockReturnValue(false);
		const endpoint = vi.fn();
		bindGdprSelfService({ callGdprEndpoint: endpoint });

		(document.querySelector('[data-gdpr-delete]') as HTMLButtonElement).click();

		expect(endpoint).not.toHaveBeenCalled();
	});
});
