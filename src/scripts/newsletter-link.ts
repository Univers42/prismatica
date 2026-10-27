/* Sends the token from a newsletter e-mail link to its API route and names the outcome, so the
   confirm and unsubscribe pages tell a spent link apart from a service that did not answer. */

export type NewsletterOutcome = 'done' | 'missing' | 'refused' | 'unreachable';

export async function postNewsletterToken(fetcher: typeof fetch, path: string, search: string): Promise<NewsletterOutcome> {
	const token = new URLSearchParams(search).get('token');
	if (!token) return 'missing';
	try {
		const response = await fetcher(path, {
			method: 'POST',
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
			body: JSON.stringify({ token }),
		});
		return response.ok ? 'done' : 'refused';
	} catch {
		return 'unreachable';
	}
}
