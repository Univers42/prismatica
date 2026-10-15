// /auth/confirm: the signed link from the confirmation email (scripts/auth/link-signing.mjs) is
// read from the fragment, dropped from the address bar, and posted to POST /api/auth/verify. The
// outcome stays on the page with its next step: sign in, ask for a new link, or try again.
import type { AuthResult, useAuth } from '../hooks/useAuth';
import { forgetFragment, readSignedLink, type SignedLink } from '../lib/auth-link';
import { showWhen } from '../lib/dom-utils';

type VerifyClient = Pick<ReturnType<typeof useAuth>, 'verifyEmail'>;
type PageLocation = Pick<Location, 'hash' | 'pathname' | 'search'>;
type PageHistory = Pick<History, 'state' | 'replaceState'>;

const NO_LINK = 'This page needs the full link from your confirmation email. Ask for a new one below.';
const UNAVAILABLE = 'The sign-in service did not answer. Try again in a minute.';

function report(root: HTMLElement, state: string, message: string): void {
	const status = root.querySelector('[data-auth-status]');
	if (status) {
		status.textContent = message;
		status.classList.toggle('is-error', state !== 'confirmed');
	}
	showWhen(root, state);
}

function stateOf(result: AuthResult): string {
	if (result.ok) return 'confirmed';
	return result.status === 410 || result.status === 400 ? 'refused' : 'unavailable';
}

async function verify(root: HTMLElement, client: VerifyClient, link: SignedLink): Promise<void> {
	try {
		const result = await client.verifyEmail(link);
		report(root, stateOf(result), result.message);
	} catch {
		report(root, 'unavailable', UNAVAILABLE);
	}
}

export async function confirmEmailLink(root: HTMLElement, client: VerifyClient, location: PageLocation, history: PageHistory): Promise<void> {
	const link = readSignedLink(location.hash, 'signup');
	if (location.hash) forgetFragment(location, history);
	if (!link) {
		report(root, 'refused', NO_LINK);
		return;
	}
	root.querySelector('[data-confirm-retry]')?.addEventListener('click', () => void verify(root, client, link));
	await verify(root, client, link);
}
