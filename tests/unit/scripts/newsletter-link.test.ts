import { describe, expect, it, vi } from 'vitest';
import { postNewsletterToken } from '../../../src/scripts/newsletter-link';

const answering = (status: number) => vi.fn<typeof fetch>(async () => new Response('{}', { status }));

describe('postNewsletterToken', () => {
	it('posts the token from the link and reports success', async () => {
		const fetchMock = answering(200);
		expect(await postNewsletterToken(fetchMock, '/api/newsletter/confirm', '?token=t-1')).toBe('done');
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/newsletter/confirm');
		expect(init?.method).toBe('POST');
		expect(JSON.parse(String(init?.body))).toEqual({ token: 't-1' });
	});

	it('reports a link without a token as missing, without calling the service', async () => {
		const fetchMock = answering(200);
		expect(await postNewsletterToken(fetchMock, '/api/newsletter/unsubscribe', '?email=a%40example.com')).toBe('missing');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('tells a refused token apart from a service that did not answer', async () => {
		expect(await postNewsletterToken(answering(410), '/api/newsletter/confirm', '?token=t-1')).toBe('refused');
		const offline = vi.fn<typeof fetch>(async () => {
			throw new TypeError('network down');
		});
		expect(await postNewsletterToken(offline, '/api/newsletter/confirm', '?token=t-1')).toBe('unreachable');
	});
});
