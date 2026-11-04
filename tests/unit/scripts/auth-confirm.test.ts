import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmEmailLink } from '../../../src/scripts/auth-confirm';

const MARKUP = `
	<main data-auth-confirm>
		<p data-auth-status role="status">Checking your link…</p>
		<button data-when="confirmed" hidden>Sign in</button>
		<button data-when="refused" hidden>Send a new link</button>
		<button data-confirm-retry data-when="unavailable" hidden>Try again</button>
	</main>`;
const LINK = '#token_hash=pkce_abc&type=signup&exp=1792100000&sig=c2ln';

function page(hash: string) {
	document.body.innerHTML = MARKUP;
	const root = document.querySelector<HTMLElement>('[data-auth-confirm]')!;
	const history = { state: null, replaceState: vi.fn() };
	const visible = () => Array.from(root.querySelectorAll<HTMLElement>('[data-when]')).filter((el) => !el.hidden).map((el) => el.dataset.when);
	const status = () => root.querySelector('[data-auth-status]')!;
	return { root, location: { hash, pathname: '/auth/confirm', search: '' }, history, visible, status };
}

describe('/auth/confirm', () => {
	beforeEach(() => vi.restoreAllMocks());

	it('posts the link once, drops it from the address bar, and offers sign-in when confirmed', async () => {
		const p = page(LINK);
		const verifyEmail = vi.fn(async () => ({ ok: true, status: 200, message: 'Your email is confirmed. You can sign in now.' }));
		await confirmEmailLink(p.root, { verifyEmail }, p.location, p.history);
		expect(verifyEmail).toHaveBeenCalledWith({ token_hash: 'pkce_abc', type: 'signup', exp: '1792100000', sig: 'c2ln' });
		expect(p.history.replaceState).toHaveBeenCalledWith(null, '', '/auth/confirm');
		expect(p.status().textContent).toBe('Your email is confirmed. You can sign in now.');
		expect(p.visible()).toEqual(['confirmed']);
	});

	it('shows the gateway reason and offers a new link when the link is refused (410)', async () => {
		const p = page(LINK);
		const verifyEmail = vi.fn(async () => ({ ok: false, status: 410, code: 'link_used', message: 'This link was already used or replaced by a newer one. Ask for a new link.' }));
		await confirmEmailLink(p.root, { verifyEmail }, p.location, p.history);
		expect(p.status().textContent).toContain('already used');
		expect(p.status().classList.contains('is-error')).toBe(true);
		expect(p.visible()).toEqual(['refused']);
	});

	it('offers a new link without any call when the page has no link', async () => {
		const p = page('');
		const verifyEmail = vi.fn();
		await confirmEmailLink(p.root, { verifyEmail }, p.location, p.history);
		expect(verifyEmail).not.toHaveBeenCalled();
		expect(p.visible()).toEqual(['refused']);
	});

	it('keeps the link for a retry when the service does not answer, and the retry posts it again', async () => {
		const p = page(LINK);
		const verifyEmail = vi.fn()
			.mockRejectedValueOnce(new TypeError('Failed to fetch'))
			.mockResolvedValueOnce({ ok: true, status: 200, message: 'Your email is confirmed. You can sign in now.' });
		await confirmEmailLink(p.root, { verifyEmail }, p.location, p.history);
		expect(p.visible()).toEqual(['unavailable']);
		p.root.querySelector<HTMLButtonElement>('[data-confirm-retry]')!.click();
		await vi.waitFor(() => expect(p.visible()).toEqual(['confirmed']));
		expect(verifyEmail).toHaveBeenCalledTimes(2);
		expect(verifyEmail.mock.calls[1]).toEqual(verifyEmail.mock.calls[0]);
	});
});
