// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ACCOUNT_MAIL_ACCEPTED, REGISTER_ACCEPTED, addressBucketKey, createAccountMail, tokenHashFrom } from '../../../scripts/auth/account-mail.mjs';
import { renderMessage } from '../../../scripts/auth/mail-templates.mjs';
import { createWorkQueue } from '../../../scripts/auth/work-queue.mjs';
import { fail, fakeGotrue, memoryStore, ok } from './fakes';

const dir = resolve(__dirname, '../../../src/email-templates');
type Mail = { to: string; subject: string; html: string; text: string };
const HASH = 'c'.repeat(56);
const SITE = 'https://prismatica.example';

/** A queue that only records: lets a test look at the state the moment the handler answers. */
function heldQueue() {
	const jobs: { label: string; task: () => Promise<unknown> }[] = [];
	return { jobs, push: vi.fn((label: string, task: () => Promise<unknown>) => (jobs.push({ label, task }), true)), runAll: async () => { for (const job of jobs.splice(0)) await job.task(); } };
}

function setup(overrides: Record<string, any> = {}, gotrueOverrides: Parameters<typeof fakeGotrue>[0] = {}) {
	const { api } = fakeGotrue({ generateLink: async () => ok({ hashed_token: HASH, action_link: 'http://kong:8000/auth/v1/verify?token=abc&type=recovery' }), ...gotrueOverrides });
	const known = new Set(['ines@arlet.test']);
	const deps = {
		store: memoryStore(),
		queue: heldQueue(),
		gotrue: api,
		mailer: { send: vi.fn(async (_message: Mail) => undefined) },
		render: (name: string, vars: Record<string, string>) => renderMessage(dir, name, vars),
		links: { configured: true, url: (type: string, tokenHash: string) => `${SITE}/${type === 'signup' ? 'auth/confirm' : 'auth/reset-password'}#token_hash=${tokenHash}&type=${type}&exp=1&sig=s`, expiresIn: (type: string) => (type === 'signup' ? '24 hours' : '60 minutes') },
		siteUrl: SITE,
		profiles: { emailExists: vi.fn(async (email: string) => known.has(email)), usernameTaken: vi.fn(async () => false), create: vi.fn(async () => true) },
		isDeliverable: vi.fn(async () => true),
		audit: vi.fn(),
		newsletterOptIn: vi.fn(async () => undefined),
		...overrides,
	};
	return { mail: createAccountMail(deps), deps, api };
}

const lookups = (deps: ReturnType<typeof setup>['deps'], api: ReturnType<typeof setup>['api']) =>
	deps.profiles.emailExists.mock.calls.length + deps.isDeliverable.mock.calls.length + api.generateLink.mock.calls.length + deps.mailer.send.mock.calls.length;

describe('/recover and /resend-verification answer first (C5)', () => {
	it.each(['requestRecovery', 'requestVerificationResend'] as const)('%s: a known and an unknown address get the identical 202, before any lookup', async (method) => {
		const { mail, deps, api } = setup();
		const known = await mail[method]('ines@arlet.test');
		const unknown = await mail[method]('nobody@arlet.test');
		expect(known).toEqual({ status: 202, body: ACCOUNT_MAIL_ACCEPTED });
		expect(unknown).toEqual(known);
		expect(lookups(deps, api)).toBe(0);
		expect(deps.queue.push).toHaveBeenCalledTimes(2);
	});

	it('answers the same 202 to a malformed address and queues nothing', async () => {
		const { mail, deps } = setup();
		expect(await mail.requestRecovery('not-an-address')).toEqual({ status: 202, body: ACCOUNT_MAIL_ACCEPTED });
		expect(deps.queue.push).not.toHaveBeenCalled();
	});
});

describe('one per-address bucket, 3 per hour (C7)', () => {
	it('is shared by /recover and /resend-verification, keyed on the lowercased trimmed address', async () => {
		const { mail, deps } = setup();
		const answers = [
			await mail.requestRecovery('ines@arlet.test'),
			await mail.requestVerificationResend(' INES@arlet.test '),
			await mail.requestRecovery('Ines@Arlet.Test'),
			await mail.requestVerificationResend('ines@arlet.test'),
		];
		expect(new Set(answers.map((answer) => JSON.stringify(answer))).size).toBe(1);
		expect(deps.queue.push).toHaveBeenCalledTimes(3);
		expect(await deps.store.get(addressBucketKey('ines@arlet.test'))).toBe('4');
		expect(addressBucketKey(' INES@arlet.test ')).toBe(addressBucketKey('ines@arlet.test'));
	});

	it('leaves other addresses alone', async () => {
		const { mail, deps } = setup();
		for (let index = 0; index < 4; index += 1) await mail.requestRecovery('ines@arlet.test');
		await mail.requestRecovery('jules@arlet.test');
		expect(deps.queue.push).toHaveBeenCalledTimes(4);
	});
});

describe('the recovery mail (R4)', () => {
	it("links the signed reset page with GoTrue's hashed_token, never its action_link", async () => {
		const { mail, deps, api } = setup();
		await mail.requestRecovery('ines@arlet.test');
		await deps.queue.runAll();
		expect(api.generateLink).toHaveBeenCalledWith({ type: 'recovery', email: 'ines@arlet.test' });
		const sent = deps.mailer.send.mock.calls[0]?.[0];
		expect(sent).toMatchObject({ to: 'ines@arlet.test', subject: 'Reset your password' });
		expect(sent?.text).toContain(`${SITE}/auth/reset-password#token_hash=${HASH}&type=recovery`);
		expect(`${sent?.text}${sent?.html}`).not.toContain('kong:8000');
		expect(sent?.text).toContain('60 minutes');
	});

	it('sends nothing for an address GoTrue does not know, and audits it', async () => {
		const { mail, deps } = setup({}, { generateLink: async () => fail(404, { msg: 'User not found' }) });
		await mail.requestRecovery('nobody@arlet.test');
		await deps.queue.runAll();
		expect(deps.mailer.send).not.toHaveBeenCalled();
		expect(deps.audit).toHaveBeenCalledWith('password_recovery_link_failed', expect.objectContaining({ status: 404 }));
	});

	it('sends nothing and calls nothing when links cannot be signed', async () => {
		const { mail, deps, api } = setup({ links: { configured: false, url: () => '', expiresIn: () => '' } });
		await mail.requestRecovery('ines@arlet.test');
		await deps.queue.runAll();
		expect(api.generateLink).not.toHaveBeenCalled();
		expect(deps.mailer.send).not.toHaveBeenCalled();
	});
});

describe('resend verification (C3)', () => {
	it('never asks GoTrue for an address without an account, and never sends a password', async () => {
		const { mail, deps, api } = setup();
		await mail.requestVerificationResend('nobody@arlet.test');
		await mail.requestVerificationResend('ines@arlet.test');
		await deps.queue.runAll();
		expect(api.generateLink).toHaveBeenCalledTimes(1);
		expect(api.generateLink).toHaveBeenCalledWith({ type: 'signup', email: 'ines@arlet.test' });
		expect(deps.mailer.send.mock.calls[0]?.[0]).toMatchObject({ subject: 'Confirm your email' });
	});
});

describe('register answers 202 either way (Q6)', () => {
	const context = (email: string) => ({ email, password: 'Sign-Up-Pass-1!', profile: { username: 'ines_c', newsletter_consent: false }, userMetadata: { username: 'ines_c' } });

	it('gives a taken and a new address the same 202, and mails the taken one "you already have an account"', async () => {
		const { mail, deps, api } = setup();
		const taken = await mail.requestRegistration(context('ines@arlet.test'));
		const fresh = await mail.requestRegistration(context('new@arlet.test'));
		expect(taken).toEqual({ status: 202, body: REGISTER_ACCEPTED });
		expect(fresh).toEqual(taken);
		await deps.queue.runAll();
		const subjects = deps.mailer.send.mock.calls.map(([sent]) => [sent.to, sent.subject]);
		expect(subjects).toEqual([['ines@arlet.test', 'You already have an account'], ['new@arlet.test', 'Confirm your email']]);
		expect(api.generateLink).toHaveBeenCalledTimes(1);
		expect(api.generateLink).toHaveBeenCalledWith({ type: 'signup', email: 'new@arlet.test', password: 'Sign-Up-Pass-1!', data: { username: 'ines_c' } });
		expect(deps.profiles.create).toHaveBeenCalledTimes(1);
	});

	it('also mails "you already have an account" when only GoTrue knows the address', async () => {
		const { mail, deps } = setup({}, { generateLink: async () => fail(422, { error_code: 'email_exists', msg: 'A user with this email address has already been registered' }) });
		await mail.requestRegistration(context('ghost@arlet.test'));
		await deps.queue.runAll();
		expect(deps.mailer.send.mock.calls[0]?.[0].subject).toBe('You already have an account');
		expect(deps.profiles.create).not.toHaveBeenCalled();
	});

	it('refuses a taken username with 409 whatever the address, so the answer says nothing about the address', async () => {
		const { mail } = setup({ profiles: { emailExists: vi.fn(), usernameTaken: vi.fn(async () => true), create: vi.fn() } });
		const known = await mail.requestRegistration(context('ines@arlet.test'));
		const unknown = await mail.requestRegistration(context('new@arlet.test'));
		expect(known.status).toBe(409);
		expect(unknown).toEqual(known);
	});
});

describe('register honours the signup allowlist (SGN-2)', () => {
	const context = (email: string) => ({ email, password: 'Sign-Up-Pass-1!', profile: { username: 'ines_c', newsletter_consent: false }, userMetadata: { username: 'ines_c' } });
	const onlyInes = (email: string) => email === 'new@arlet.test';

	it('answers a refused address like an allowed one, but creates no user, mails nothing and takes no bucket slot', async () => {
		const { mail, deps, api } = setup({ signupAllowed: onlyInes });
		const refused = await mail.requestRegistration(context('stranger@evil.test'));
		const allowed = await mail.requestRegistration(context('new@arlet.test'));
		expect(refused).toEqual({ status: 202, body: REGISTER_ACCEPTED });
		expect(refused).toEqual(allowed);
		await deps.queue.runAll();
		expect(deps.mailer.send).toHaveBeenCalledTimes(1);
		expect(deps.mailer.send.mock.calls[0]?.[0].to).toBe('new@arlet.test');
		expect(api.generateLink).toHaveBeenCalledTimes(1);
		expect(deps.profiles.create).toHaveBeenCalledTimes(1);
		expect(await deps.store.get(addressBucketKey('stranger@evil.test'))).toBeNull();
		expect(deps.audit).toHaveBeenCalledWith('signup_refused_allowlist', { email: 'stranger@evil.test', source: 'register' });
	});

	it('still answers a taken username with 409 for a refused address, so the 409 is no oracle for the list', async () => {
		const { mail } = setup({ signupAllowed: onlyInes, profiles: { emailExists: vi.fn(), usernameTaken: vi.fn(async () => true), create: vi.fn() } });
		const refused = await mail.requestRegistration(context('stranger@evil.test'));
		expect(refused.status).toBe(409);
		expect(await mail.requestRegistration(context('new@arlet.test'))).toEqual(refused);
	});

	it('leaves /recover and /resend-verification ungated (SGN-4)', async () => {
		const { mail, deps } = setup({ signupAllowed: () => false });
		await mail.requestRecovery('ines@arlet.test');
		await mail.requestVerificationResend('ines@arlet.test');
		await deps.queue.runAll();
		expect(deps.mailer.send).toHaveBeenCalledTimes(2);
		expect(deps.audit).not.toHaveBeenCalledWith('signup_refused_allowlist', expect.anything());
	});
});

describe('work after the 202 cannot crash the gateway (C6)', () => {
	it('keeps serving when GoTrue throws inside a queued job, with no unhandled rejection', async () => {
		const unhandled = vi.fn();
		process.on('unhandledRejection', unhandled);
		const onError = vi.fn();
		const queue = createWorkQueue({ maxLength: 10, concurrency: 2, onError });
		let calls = 0;
		const { mail, deps } = setup({ queue }, {
			generateLink: async () => {
				calls += 1;
				if (calls === 1) throw new Error('GoTrue is down');
				return ok({ hashed_token: HASH });
			},
		});
		expect((await mail.requestRecovery('ines@arlet.test')).status).toBe(202);
		await queue.idle();
		expect((await mail.requestRecovery('ines@arlet.test')).status).toBe(202);
		await queue.idle();
		await new Promise((done) => setTimeout(done, 5));
		process.off('unhandledRejection', unhandled);
		expect(onError).toHaveBeenCalledTimes(1);
		expect(deps.mailer.send).toHaveBeenCalledTimes(1);
		expect(unhandled).not.toHaveBeenCalled();
	});
});

describe('tokenHashFrom', () => {
	it('reads hashed_token wherever GoTrue puts it and ignores action_link', () => {
		expect(tokenHashFrom({ hashed_token: 'h1', action_link: 'x' })).toBe('h1');
		expect(tokenHashFrom({ properties: { hashed_token: 'h2', action_link: 'x' } })).toBe('h2');
		expect(tokenHashFrom({ action_link: 'https://kong/verify?token=t' })).toBe('');
	});
});

describe('the password-changed notice', () => {
	it('is queued for the address without spending its bucket, and names the time', async () => {
		const { mail, deps } = setup();
		for (let index = 0; index < 3; index += 1) await mail.requestRecovery('ines@arlet.test');
		mail.schedulePasswordChanged('ines@arlet.test', 'Thursday 15 October 2026 at 12:00 UTC');
		await deps.queue.runAll();
		const notice = deps.mailer.send.mock.calls.map(([sent]) => sent).find((sent) => sent.subject === 'Your password was changed');
		expect(notice?.text).toContain('Thursday 15 October 2026 at 12:00 UTC');
		expect(await deps.store.get(addressBucketKey('ines@arlet.test'))).toBe('3');
	});
});

describe('the sign-in code request', () => {
	const issue = vi.fn(async (email: string) => (email === 'ines@arlet.test' ? '482913' : ''));

	it('answers the same 202 at once for a known, an unknown and a malformed address, doing no lookup first', async () => {
		const { mail, deps, api } = setup({ signInCodes: { issue } });
		const known = await mail.requestSignInCode('ines@arlet.test');
		const unknown = await mail.requestSignInCode('nobody@arlet.test');
		const malformed = await mail.requestSignInCode('not-an-address');
		const tooLong = await mail.requestSignInCode(`${'a'.repeat(250)}@arlet.test`);
		expect(known).toEqual({ status: 202, body: ACCOUNT_MAIL_ACCEPTED });
		for (const other of [unknown, malformed, tooLong]) expect(other).toEqual(known);
		expect(lookups(deps, api) + issue.mock.calls.length).toBe(0);
		expect(deps.queue.push).toHaveBeenCalledTimes(2);
	});

	it('mails the code, and only the code, once the job runs; an address with no code gets no mail', async () => {
		issue.mockClear();
		const { mail, deps } = setup({ signInCodes: { issue } });
		await mail.requestSignInCode('ines@arlet.test');
		await mail.requestSignInCode('nobody@arlet.test');
		await deps.queue.runAll();
		expect(deps.mailer.send).toHaveBeenCalledTimes(1);
		const sent = deps.mailer.send.mock.calls[0][0];
		expect(sent).toMatchObject({ to: 'ines@arlet.test', subject: 'Your sign-in code' });
		expect(sent.text).toContain('482913');
		expect(sent.html).toContain('482913');
		expect(`${sent.text}${sent.html}`).not.toMatch(/https?:\/\/(?!prismatica\.example)|token_hash|action_link|href="[^"]*(verify|confirm|reset)/);
	});

	it('does not look the address up when its domain cannot receive mail', async () => {
		issue.mockClear();
		const { mail, deps } = setup({ signInCodes: { issue }, isDeliverable: vi.fn(async () => false) });
		await mail.requestSignInCode('ines@arlet.test');
		await deps.queue.runAll();
		expect(issue).not.toHaveBeenCalled();
		expect(deps.mailer.send).not.toHaveBeenCalled();
	});

	it('has its own bucket per kind: 3 codes an hour, and neither spends the recovery bucket nor the reverse', async () => {
		const { mail, deps } = setup({ signInCodes: { issue } });
		for (let index = 0; index < 4; index += 1) await mail.requestSignInCode('ines@arlet.test');
		expect(deps.queue.push).toHaveBeenCalledTimes(3);
		await mail.requestRecovery('ines@arlet.test');
		await mail.requestRecovery('ines@arlet.test');
		await mail.requestRecovery('ines@arlet.test');
		expect(deps.queue.push).toHaveBeenCalledTimes(6);
		expect(await deps.store.get(addressBucketKey('ines@arlet.test', 'signin-code'))).toBe('4');
		expect(await deps.store.get(addressBucketKey('ines@arlet.test'))).toBe('3');
		expect(addressBucketKey('ines@arlet.test', 'signin-code')).not.toBe(addressBucketKey('ines@arlet.test', 'recovery'));
		expect(addressBucketKey('ines@arlet.test', 'recovery')).toBe(addressBucketKey('ines@arlet.test'));
	});

	it('mails nothing and throws nothing when no code issuer is wired', async () => {
		const { mail, deps } = setup();
		await mail.requestSignInCode('ines@arlet.test');
		await deps.queue.runAll();
		expect(deps.mailer.send).not.toHaveBeenCalled();
	});
});
