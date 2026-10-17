import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountApprovePage } from '../../../src/scripts/auth-approve';
import { takeApprovalToken } from '../../../src/lib/link-fragment';

const source = readFileSync(resolve(__dirname, '../../../src/pages/auth/approve.astro'), 'utf8');
const TOKEN = 'T'.repeat(43);
const answer = (status: number, body: Record<string, unknown> = {}) => ({ status, body });

function mount(hash: string, post: (path: string, payload: Record<string, unknown>) => Promise<{ status: number; body: Record<string, unknown> }>) {
	const replaceState = vi.fn();
	const root = document.querySelector<HTMLElement>('[data-auth-approve]')!;
	return { replaceState, done: mountApprovePage(root, { location: { hash, pathname: '/auth/approve', search: '' }, history: { replaceState }, post }), root };
}

const q = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const summaryBody = { summary: { occurredAt: 'Saturday', userAgent: 'Firefox Linux', ipAddress: '203.0.113.7', location: 'Unknown location' }, expiresInSec: 500 };

beforeEach(() => {
	document.body.innerHTML = source.match(/<main[\s\S]*<\/main>/)![0];
});

describe('approve page', () => {
	it('is static markup: the form is hidden and no request is made by the page itself', () => {
		expect(q('[data-approve-form]').hidden).toBe(true);
		expect(source).not.toMatch(/method:\s*['"]GET['"]/);
		expect(q<HTMLInputElement>('#approve-number').getAttribute('inputmode')).toBe('numeric');
		expect(q('[data-approve-deny]').textContent).toBe("It wasn't me");
	});

	it('reads #t, clears the fragment first, fetches the summary by POST and shows it', async () => {
		const post = vi.fn(async () => answer(200, summaryBody));
		const { replaceState, done } = mount(`#t=${TOKEN}`, post);
		await done;
		expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/approve');
		expect(post).toHaveBeenCalledExactlyOnceWith('/mfa/approve/summary', { token: TOKEN });
		expect(q('[data-approve-browser]').textContent).toBe('Firefox Linux');
		expect(q('[data-approve-form]').hidden).toBe(false);
	});

	it('sends nothing for a missing or malformed token', async () => {
		for (const hash of ['', '#t=short', `#x=${TOKEN}`]) {
			document.body.innerHTML = source.match(/<main[\s\S]*<\/main>/)![0];
			const post = vi.fn();
			await mount(hash, post).done;
			expect(post).not.toHaveBeenCalled();
			expect(q('[data-approve-status]').textContent).toMatch(/incomplete/);
		}
	});

	it('shows a generic message and no form when the request is gone', async () => {
		const { done } = mount(`#t=${TOKEN}`, vi.fn(async () => answer(410, { message: 'This sign-in request is no longer valid.' })));
		await done;
		expect(q('[data-approve-form]').hidden).toBe(true);
		expect(q('[data-approve-status]').textContent).toMatch(/no longer valid/);
	});

	it('refuses a non-2-digit number in the browser; a typed number posts {token, match}', async () => {
		const post = vi.fn(async (path: string) => (path === '/mfa/approve/summary' ? answer(200, summaryBody) : answer(200, { approved: true })));
		await mount(`#t=${TOKEN}`, post).done;
		const form = q<HTMLFormElement>('[data-approve-form]');
		q<HTMLInputElement>('#approve-number').value = '4';
		form.dispatchEvent(new Event('submit', { cancelable: true }));
		expect(post).toHaveBeenCalledTimes(1);
		q<HTMLInputElement>('#approve-number').value = '42';
		form.dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.waitFor(() => expect(post).toHaveBeenCalledWith('/mfa/approve', { token: TOKEN, match: '42' }));
		await vi.waitFor(() => expect(q('[data-approve-status]').textContent).toMatch(/Approved/));
	});

	it('"It wasn\'t me" posts the denial', async () => {
		const post = vi.fn(async (path: string) => (path === '/mfa/approve/summary' ? answer(200, summaryBody) : answer(200, { denied: true })));
		await mount(`#t=${TOKEN}`, post).done;
		q<HTMLButtonElement>('[data-approve-deny]').click();
		await vi.waitFor(() => expect(post).toHaveBeenCalledWith('/mfa/deny', { token: TOKEN }));
		await vi.waitFor(() => expect(q('[data-approve-status]').textContent).toMatch(/Denied/));
	});
});

describe('takeApprovalToken', () => {
	it('returns a 43-character token and clears any fragment, even a bad one', () => {
		const replaceState = vi.fn();
		expect(takeApprovalToken({ hash: `#t=${TOKEN}`, pathname: '/p', search: '?a=1' }, { replaceState })).toBe(TOKEN);
		expect(replaceState).toHaveBeenCalledWith(null, '', '/p?a=1');
		expect(takeApprovalToken({ hash: '#t=nope', pathname: '/p', search: '' }, { replaceState })).toBeNull();
		expect(replaceState).toHaveBeenCalledTimes(2);
		replaceState.mockClear();
		expect(takeApprovalToken({ hash: '', pathname: '/p', search: '' }, { replaceState })).toBeNull();
		expect(replaceState).not.toHaveBeenCalled();
	});
});
