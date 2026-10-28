function setActionState(container: HTMLElement, message: string, busy = false): void {
	const status = container.querySelector('[data-gdpr-self-service-status]');
	if (status instanceof HTMLOutputElement) status.textContent = message;
	container.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = busy; });
}

function endpointCaller(deps: {
	callGdprEndpoint?: (path: string, method: 'GET' | 'POST' | 'DELETE', payload?: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown } | null>;
}) {
	return deps.callGdprEndpoint ?? (async (_path: string, _method: 'GET' | 'POST' | 'DELETE', _payload?: Record<string, unknown>) => ({ ok: false }));
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
			const response = await callEndpoint('/gdpr/v1/export', 'GET');
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
			const response = await callEndpoint('/gdpr/v1/deletion-requests', 'POST', {});
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
