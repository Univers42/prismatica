/* The page behind the "Approve" button of the sign-in mail. Nothing here runs on a GET of the page:
   the script reads the fragment, asks the gateway for the request summary by POST, and only a typed
   number plus a click sends the approval. The approving device never receives a session. */

import { gatewayMessage, postToGateway, takeApprovalToken, type GatewayAnswer } from '../lib/link-fragment';

type Post = (path: string, payload: Record<string, unknown>) => Promise<GatewayAnswer>;

export type ApproveDeps = {
	location: Pick<Location, 'hash' | 'pathname' | 'search'>;
	history: Pick<History, 'replaceState'>;
	post: Post;
};

export function gatewayPoster(fetchImpl: typeof fetch, gatewayUrl: string): Post {
	return (path, payload) => postToGateway(fetchImpl, gatewayUrl, path, payload);
}

type Summary = { occurredAt?: string; ipAddress?: string; location?: string; userAgent?: string };

const GONE = 'This sign-in request is no longer valid. Nothing was approved; you can close this page.';

function pick<T extends HTMLElement>(root: HTMLElement, name: string): T {
	const found = root.querySelector<T>(`[data-approve-${name}]`);
	if (!found) throw new Error(`approve page: missing [data-approve-${name}]`);
	return found;
}

function showSummary(root: HTMLElement, summary: Summary): void {
	const fields: [string, string | undefined][] = [['time', summary.occurredAt], ['browser', summary.userAgent], ['address', summary.ipAddress], ['place', summary.location]];
	for (const [name, value] of fields) pick(root, name).textContent = value ?? 'unknown';
	pick(root, 'details').hidden = false;
}

export async function mountApprovePage(root: HTMLElement, deps: ApproveDeps): Promise<void> {
	const status = pick(root, 'status');
	const form = pick<HTMLFormElement>(root, 'form');
	const number = pick<HTMLInputElement>(root, 'number');
	const deny = pick<HTMLButtonElement>(root, 'deny');
	const finish = (message: string, isError = false): void => {
		form.hidden = true;
		status.textContent = message;
		status.classList.toggle('is-error', isError);
	};
	// The fragment leaves the address bar before any request is made.
	const token = takeApprovalToken(deps.location, deps.history);
	if (!token) return finish('This approval link is incomplete. Nothing was approved.', true);

	const summary = await deps.post('/mfa/approve/summary', { token });
	if (summary.status !== 200) return finish(summary.status === 410 ? GONE : gatewayMessage(summary, GONE), true);
	showSummary(root, (summary.body.summary ?? {}) as Summary);
	status.textContent = 'Someone is signing in with your password. Approve only if it is you.';
	form.hidden = false;
	number.focus();

	form.addEventListener('submit', (event) => {
		event.preventDefault();
		if (!/^\d{2}$/.test(number.value.trim())) {
			status.textContent = 'Type the 2-digit number shown on the screen you are signing in on.';
			return;
		}
		void deps.post('/mfa/approve', { token, match: number.value.trim() }).then((answer) => {
			if (answer.status === 200) finish('Approved. Go back to the screen you are signing in on; you can close this page.');
			else finish(gatewayMessage(answer, GONE), true);
		});
	});
	deny.addEventListener('click', () => {
		void deps.post('/mfa/deny', { token }).then((answer) => {
			if (answer.status === 200) finish('Denied. This sign-in was cancelled and password sign-in for the account is paused for a few minutes. Reset your password if you did not start it.');
			else finish(gatewayMessage(answer, GONE), true);
		});
	});
}
