/**
 * Reads the signed e-mail link out of `location.hash` and posts it to the auth gateway.
 *
 * The token rides in the fragment so no server log or Referer carries it. `takeLinkFragment`
 * therefore removes the fragment from the address bar before returning, and `postToGateway`
 * is the only fetch the link pages make: JSON body, no query string, no cookies, no Referer.
 * Caveat: replaceState drops the fragment from the visible URL and history entry only; the
 * parsed fields stay in the page's memory until the tab closes, and an extension with page
 * access can read them there.
 */

export type LinkFields = { token_hash: string; type: string; exp: string; sig: string };

type FragmentLocation = Pick<Location, 'hash' | 'pathname' | 'search'>;
type FragmentHistory = Pick<History, 'replaceState'>;

const REQUIRED_KEYS = ['token_hash', 'type', 'exp', 'sig'] as const;

export function takeLinkFragment(location: FragmentLocation, history: FragmentHistory, expectedType: string): LinkFields | null {
	const params = new URLSearchParams(location.hash.replace(/^#/, ''));
	if (location.hash !== '') history.replaceState(null, '', `${location.pathname}${location.search}`);
	const values = REQUIRED_KEYS.map((key) => params.get(key) ?? '');
	if (values.some((value) => value === '')) return null;
	const [token_hash, type, exp, sig] = values;
	return type === expectedType ? { token_hash, type, exp, sig } : null;
}

const APPROVAL_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** The sign-in approval token from `#t=<token>`; the fragment is removed from the address bar either way. */
export function takeApprovalToken(location: FragmentLocation, history: FragmentHistory): string | null {
	const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('t') ?? '';
	if (location.hash !== '') history.replaceState(null, '', `${location.pathname}${location.search}`);
	return APPROVAL_TOKEN.test(token) ? token : null;
}

export type GatewayAnswer = { status: number; body: Record<string, unknown> };

export async function postToGateway(fetchImpl: typeof fetch, gatewayUrl: string, path: string, payload: Record<string, unknown>): Promise<GatewayAnswer> {
	const response = await fetchImpl(`${gatewayUrl.replace(/\/$/, '')}${path}`, {
		method: 'POST',
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		credentials: 'omit',
		referrerPolicy: 'no-referrer',
	});
	const parsed: unknown = await response.json().catch(() => ({}));
	return { status: response.status, body: parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {} };
}

export function gatewayMessage(answer: GatewayAnswer, fallback: string): string {
	return typeof answer.body.message === 'string' && answer.body.message !== '' ? answer.body.message : fallback;
}
