import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PENDING_KEY = 'prismatica.oauth.pending';

type HistoryFake = { state: null; replaceState: ReturnType<typeof vi.fn> };
type LocationFake = { pathname: string; search: string; hash: string };

function buildCallbackSetup(options: { search?: string; hash?: string; onReplace?: () => void } = {}) {
	const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
	const history: HistoryFake = { state: null, replaceState: vi.fn(options.onReplace) };
	const location: LocationFake = {
		pathname: '/auth/callback',
		search: options.search ?? '?code=abc',
		hash: options.hash ?? '',
	};
	return { root, history, location };
}

function storePendingFlow(createdAt: number = Date.now()): void {
	sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier: 'v', provider: 'google', createdAt }));
}

function stubFetch(reply?: { body: unknown; status: number; onFetch?: () => void }) {
	const fetchMock = vi.fn();
	if (reply) {
		fetchMock.mockImplementation(async () => {
			reply.onFetch?.();
			return new Response(JSON.stringify(reply.body), { status: reply.status });
		});
	}
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

function spyOnAssign() {
	const assign = vi.fn();
	(globalThis as unknown as { location: { assign: typeof assign } }).location.assign = assign;
	return assign;
}

async function runCallback(
	setup: ReturnType<typeof buildCallbackSetup>,
	providers: string = 'google',
): Promise<void> {
	vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', providers);
	const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
	await handleOAuthCallback(
		setup.root,
		{ gatewayUrl: '/api/auth' } as never,
		setup.location as never,
		setup.history as never,
	);
}

describe('auth callback', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.unstubAllGlobals();
		sessionStorage.clear();
		localStorage.clear();
		document.body.innerHTML = '<main data-auth-callback><p data-auth-status></p></main>';
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('cleans the URL before fetching', async () => {
		const setup = buildCallbackSetup();
		const fetchMock = stubFetch({ body: { ok: true }, status: 200 });
		storePendingFlow();
		await runCallback(setup);
		expect(setup.history.replaceState).toHaveBeenCalledWith(null, '', '/auth/callback');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('reads the pending flow once and deletes it', async () => {
		const setup = buildCallbackSetup();
		stubFetch({ body: { ok: true }, status: 200 });
		storePendingFlow();
		await runCallback(setup);
		expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
	});

	it('refuses a replay without fetching', async () => {
		const setup = buildCallbackSetup();
		const fetchMock = stubFetch();
		await runCallback(setup);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('refuses when the provider list is empty without fetching', async () => {
		const setup = buildCallbackSetup();
		const fetchMock = stubFetch();
		storePendingFlow();
		await runCallback(setup, '');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('strips the URL on the dark path with 0 storage reads and 0 fetches', async () => {
		const setup = buildCallbackSetup({ hash: '#access_token=t' });
		const fetchMock = stubFetch();
		const getItem = vi.spyOn(sessionStorage, 'getItem');
		await runCallback(setup, '');
		expect(setup.history.replaceState).toHaveBeenCalledWith(null, '', '/auth/callback');
		expect(fetchMock).not.toHaveBeenCalled();
		expect(getItem).not.toHaveBeenCalled();
	});

	it('strips a populated access_token hash before fetch and never sends or stores it', async () => {
		const order: string[] = [];
		const setup = buildCallbackSetup({
			hash: '#access_token=leaked-token',
			onReplace: () => { order.push('replaceState'); },
		});
		const fetchMock = stubFetch({ body: { ok: true }, status: 200, onFetch: () => { order.push('fetch'); } });
		storePendingFlow();
		const sessionWrite = vi.spyOn(sessionStorage, 'setItem');
		const localWrite = vi.spyOn(localStorage, 'setItem');
		await runCallback(setup);
		expect(setup.history.replaceState).toHaveBeenCalledWith(null, '', '/auth/callback');
		expect(order.indexOf('replaceState')).toBeLessThan(order.indexOf('fetch'));
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).not.toContain('leaked-token');
		expect(String(init.body)).not.toContain('leaked-token');
		const stored = [...Object.keys(sessionStorage), ...Object.keys(localStorage)]
			.map((key) => `${sessionStorage.getItem(key) ?? ''}${localStorage.getItem(key) ?? ''}`)
			.join(' ');
		expect(stored).not.toContain('leaked-token');
		expect([...sessionWrite.mock.calls, ...localWrite.mock.calls].flat().join(' ')).not.toContain('leaked-token');
	});

	it('renders the referrer policy meta in <head> through the Layout prop', () => {
		const layout = readFileSync(resolve(process.cwd(), 'src/layouts/Layout.astro'), 'utf8');
		const headStart = layout.indexOf('<head>');
		const headEnd = layout.indexOf('</head>', headStart);
		expect(headStart).toBeGreaterThan(-1);
		expect(headEnd).toBeGreaterThan(headStart);
		const head = layout.slice(headStart, headEnd);
		const metaIndex = head.indexOf('<meta name="referrer"');
		expect(metaIndex).toBeGreaterThan(-1);
		expect(head).toContain('content={referrerPolicy}');
		const firstAsset = Math.min(
			...[head.indexOf('<link'), head.indexOf('<script')].filter((index) => index >= 0),
		);
		expect(metaIndex).toBeLessThan(firstAsset);

		const callback = readFileSync(resolve(process.cwd(), 'src/pages/auth/callback.astro'), 'utf8');
		expect(callback).toMatch(/<Layout[^>]*referrerPolicy="no-referrer"/);
		expect(callback).not.toMatch(/<meta[^>]*name="referrer"/);
	});

	it('refuses a stale flow without fetching', async () => {
		const setup = buildCallbackSetup();
		const fetchMock = stubFetch();
		storePendingFlow(Date.now() - 11 * 60 * 1000);
		await runCallback(setup);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(setup.root.querySelector('[data-auth-status]')?.textContent).toContain('expired');
	});

	it('shows the collision message on 409 oauth_email_collision and does not navigate', async () => {
		const setup = buildCallbackSetup();
		const assign = spyOnAssign();
		stubFetch({ body: { error: 'oauth_email_collision' }, status: 409 });
		storePendingFlow();
		await runCallback(setup);
		expect(setup.root.querySelector('[data-auth-status]')?.textContent).toContain('already linked to another sign-in method');
		expect(assign).not.toHaveBeenCalled();
	});

	it('calls location.assign with a trusted redirectUrl', async () => {
		vi.useFakeTimers();
		const setup = buildCallbackSetup();
		const assign = spyOnAssign();
		stubFetch({ body: { ok: true, redirectUrl: 'http://localhost:4322/' }, status: 200 });
		storePendingFlow();
		await runCallback(setup);
		vi.runAllTimers();
		expect(assign).toHaveBeenCalledWith('http://localhost:4322/');
		vi.useRealTimers();
	});

	it('blocks an untrusted redirectUrl without assigning', async () => {
		const setup = buildCallbackSetup();
		const assign = spyOnAssign();
		stubFetch({ body: { ok: true, redirectUrl: 'https://evil.example/x' }, status: 200 });
		storePendingFlow();
		await runCallback(setup);
		expect(setup.root.querySelector('[data-auth-status]')?.textContent).toContain('Workspace redirect blocked');
		expect(assign).not.toHaveBeenCalled();
	});

	it('maps provider_email_needs_verification to the verification message with 0 fetches', async () => {
		const setup = buildCallbackSetup({ search: '?error_code=provider_email_needs_verification' });
		const fetchMock = stubFetch();
		storePendingFlow();
		await runCallback(setup);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(setup.root.querySelector('[data-auth-status]')?.textContent).toContain('provider email needs verification');
		expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
	});

	it('deletes the pending flow when the code is missing without fetching', async () => {
		const setup = buildCallbackSetup({ search: '?state=abc' });
		const fetchMock = stubFetch();
		storePendingFlow();
		await runCallback(setup);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
	});

	it('proves replaceState happens before the pending-flow read and before fetch', async () => {
		const order: string[] = [];
		const setup = buildCallbackSetup({ onReplace: () => { order.push('replaceState'); } });
		stubFetch({ body: { ok: true }, status: 200, onFetch: () => { order.push('fetch'); } });
		const originalGetItem = sessionStorage.getItem.bind(sessionStorage);
		Object.defineProperty(sessionStorage, 'getItem', {
			value: (key: string) => {
				if (key === PENDING_KEY) order.push('readVerifier');
				return originalGetItem(key);
			},
			writable: true,
			configurable: true,
		});
		// seed through the real store first
		storePendingFlow();
		await runCallback(setup);
		Object.defineProperty(sessionStorage, 'getItem', { value: originalGetItem, writable: true, configurable: true });
		expect(order.indexOf('replaceState')).toBeGreaterThanOrEqual(0);
		expect(order.indexOf('replaceState')).toBeLessThan(order.indexOf('readVerifier'));
		expect(order.indexOf('replaceState')).toBeLessThan(order.indexOf('fetch'));
	});

	it('keeps no auth token in storage after a successful flow', async () => {
		const setup = buildCallbackSetup();
		stubFetch({ body: { ok: true, access_token: 'fake-access-token-123' }, status: 200 });
		storePendingFlow();
		await runCallback(setup);
		const allValues = [...Object.keys(sessionStorage), ...Object.keys(localStorage)].map((k) => `${sessionStorage.getItem(k) ?? ''}${localStorage.getItem(k) ?? ''}`).join(' ');
		expect(allValues).not.toContain('fake-access-token-123');
		expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
	});
});
