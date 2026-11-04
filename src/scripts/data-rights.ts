// The /legal/data-rights forms: the request form, and the signed-in account section. Loaded by
// main.ts only on the page that has them, because it brings @grobase/js with it.
import { MiniBaasError } from '@grobase/js';
import { CSRF_STORAGE_KEY, POLICY_VERSION } from '../data/legal';
import { useAuth } from '../hooks/useAuth';
import { createPublicBaasClient } from '../lib/baas-client';
import { bindAccountPrivacy, browserDownload } from '../lib/gdpr-account';
import { bindDataRightsForm, type GdprRpcResult } from '../lib/gdpr-form';
import { readStorage, writeStorage } from '../lib/storage';
import { getAccessToken, setAccessToken } from './portal';

async function callGdprRpc(name: string, body: Record<string, unknown>, token = getAccessToken()): Promise<GdprRpcResult> {
	try {
		const data: unknown = await createPublicBaasClient(token ?? undefined).rpc(name, body);
		return { ok: true, status: 200, data };
	} catch (error) {
		if (error instanceof MiniBaasError) return { ok: false, status: error.status };
		throw error;
	}
}

/** Uses the in-memory session, or renews it from the HttpOnly refresh cookie. */
async function resolveAccessToken(): Promise<string | null> {
	const current = getAccessToken();
	if (current) return current;
	const refreshed = await useAuth().refresh().catch(() => null);
	if (!refreshed?.ok || !refreshed.accessToken) return null;
	setAccessToken(refreshed.accessToken);
	return refreshed.accessToken;
}

export function bindDataRightsPage(): void {
	bindDataRightsForm({ readStorage, writeStorage, callGdprRpc, csrfStorageKey: CSRF_STORAGE_KEY, policyVersion: POLICY_VERSION });
	void bindAccountPrivacy({ resolveAccessToken, callGdprRpc, downloadFile: browserDownload });
}
