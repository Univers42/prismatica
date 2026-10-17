import { describe, expect, it, vi } from 'vitest';
import { gatewayMessage, postToGateway, takeLinkFragment } from '../../../src/lib/link-fragment';

const HASH = 'e'.repeat(56);
const SIG = 'S'.repeat(43);
const fragment = `#token_hash=${HASH}&type=recovery&exp=1800000000&sig=${SIG}`;

describe('takeLinkFragment', () => {
	it('returns the four fields and drops the fragment, keeping path and query', () => {
		const replaceState = vi.fn();
		const fields = takeLinkFragment({ hash: fragment, pathname: '/auth/reset-password/', search: '?lang=fr' }, { replaceState }, 'recovery');
		expect(fields).toEqual({ token_hash: HASH, type: 'recovery', exp: '1800000000', sig: SIG });
		expect(replaceState).toHaveBeenCalledExactlyOnceWith(null, '', '/auth/reset-password/?lang=fr');
	});

	it('clears the fragment even when the link is incomplete or of the wrong type', () => {
		for (const hash of [`#token_hash=${HASH}`, fragment.replace('recovery', 'signup'), '#token_hash=&type=recovery&exp=1&sig=2']) {
			const replaceState = vi.fn();
			expect(takeLinkFragment({ hash, pathname: '/p', search: '' }, { replaceState }, 'recovery')).toBeNull();
			expect(replaceState).toHaveBeenCalledOnce();
		}
	});

	it('leaves history alone when there is no fragment', () => {
		const replaceState = vi.fn();
		expect(takeLinkFragment({ hash: '', pathname: '/p', search: '' }, { replaceState }, 'signup')).toBeNull();
		expect(replaceState).not.toHaveBeenCalled();
	});

	it('clears the fragment before the first fetch when the caller posts the fields', async () => {
		const order: string[] = [];
		const fetchImpl = vi.fn<typeof fetch>(async () => {
			order.push('fetch');
			return new Response('{}', { status: 200 });
		});
		const fields = takeLinkFragment({ hash: fragment, pathname: '/p', search: '' }, { replaceState: () => order.push('replaceState') }, 'recovery');
		await postToGateway(fetchImpl, '/api/auth', '/reset-password', { ...fields, password: 'x' });
		expect(order).toEqual(['replaceState', 'fetch']);
	});
});

describe('postToGateway', () => {
	it('posts JSON with no query string, no cookies and no Referer', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ message: 'done' }), { status: 200 }));
		const answer = await postToGateway(fetchImpl, 'https://gw.test/api/auth/', '/verify', { token_hash: HASH });
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe('https://gw.test/api/auth/verify');
		expect(String(url)).not.toContain('?');
		expect(init).toMatchObject({ method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer' });
		expect(JSON.parse(String(init?.body))).toEqual({ token_hash: HASH });
		expect(answer).toEqual({ status: 200, body: { message: 'done' } });
	});

	it('survives a non-JSON body', async () => {
		const answer = await postToGateway(async () => new Response('<html>', { status: 502 }), '/api/auth', '/verify', {});
		expect(answer).toEqual({ status: 502, body: {} });
	});
});

describe('gatewayMessage', () => {
	it('prefers the gateway message and falls back otherwise', () => {
		expect(gatewayMessage({ status: 410, body: { message: 'Expired.' } }, 'x')).toBe('Expired.');
		expect(gatewayMessage({ status: 410, body: {} }, 'fallback')).toBe('fallback');
	});
});
