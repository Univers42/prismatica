// The auth gateway's signed links (scripts/auth/link-signing.mjs) carry the token in the URL
// fragment, which no server log or Referer header sees (ADR 0006). A page reads the fields once,
// drops them from the address bar and history, and posts them back; the gateway checks them.
export type SignedLinkType = 'signup' | 'recovery';

export type SignedLink = {
	token_hash: string;
	type: SignedLinkType;
	exp: string;
	sig: string;
};

export function readSignedLink(fragment: string, type: SignedLinkType): SignedLink | null {
	const params = new URLSearchParams(fragment.replace(/^#/, ''));
	const tokenHash = params.get('token_hash');
	const exp = params.get('exp');
	const sig = params.get('sig');
	if (params.get('type') !== type || !tokenHash || !exp || !sig) return null;
	return { token_hash: tokenHash, type, exp, sig };
}

export function forgetFragment(location: Pick<Location, 'pathname' | 'search'>, history: Pick<History, 'state' | 'replaceState'>): void {
	history.replaceState(history.state, '', `${location.pathname}${location.search}`);
}
