import { describe, expect, it, vi } from 'vitest';
import { forgetFragment, readSignedLink } from '../../../src/lib/auth-link';

const fragment = '#token_hash=pkce_abc123&type=recovery&exp=1792100000&sig=c2lnbmF0dXJl';

describe('readSignedLink', () => {
	it('reads the four fields of a link of the expected type', () => {
		expect(readSignedLink(fragment, 'recovery')).toEqual({ token_hash: 'pkce_abc123', type: 'recovery', exp: '1792100000', sig: 'c2lnbmF0dXJl' });
	});

	it('refuses a link of the other type', () => {
		expect(readSignedLink(fragment, 'signup')).toBeNull();
	});

	it.each(['token_hash', 'exp', 'sig'])('refuses a link without %s', (field) => {
		const params = new URLSearchParams(fragment.slice(1));
		params.delete(field);
		expect(readSignedLink(`#${params}`, 'recovery')).toBeNull();
	});

	it('refuses an empty fragment and a legacy ?token= link', () => {
		expect(readSignedLink('', 'signup')).toBeNull();
		expect(readSignedLink('#', 'signup')).toBeNull();
	});
});

describe('forgetFragment', () => {
	it('drops the fragment from the address bar and keeps the path and query', () => {
		const replaceState = vi.fn();
		forgetFragment({ pathname: '/auth/confirm', search: '?from=mail' }, { state: null, replaceState });
		expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/confirm?from=mail');
	});
});
