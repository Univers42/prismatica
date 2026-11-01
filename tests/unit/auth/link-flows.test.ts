// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { signLink } from '../../../scripts/auth/link-signing.mjs';
import { createLinkFlows } from '../../../scripts/auth/link-flows.mjs';
import { fail, fakeGotrue, memoryStore, ok } from './fakes';

const KEY = 'k'.repeat(48);
const HASH = 'f'.repeat(56);
const NOW_MS = 1_800_000_000_000;
const NOW = NOW_MS / 1000;
const PASSWORD = 'New-Pass-2026!';
const recoverySession = ok({ access_token: 'aal1-token', user: { id: 'user-1', email: 'ines@arlet.test' } });

function link(type: string, exp = NOW + 600, key = KEY) {
	return { token_hash: HASH, type, exp: String(exp), sig: signLink(key, { type, tokenHash: HASH, exp }) };
}

function setup(overrides: Parameters<typeof fakeGotrue>[0] = {}, extra: Record<string, unknown> = {}) {
	const { api, totalCalls } = fakeGotrue({ verify: async () => recoverySession, listFactors: async () => ok({ factors: [] } as any), ...overrides });
	const deps = {
		gotrue: api,
		store: memoryStore(),
		linkKey: KEY,
		nowMs: () => NOW_MS,
		passwordAcceptable: (value: string) => value.length >= 8 && /[A-Z]/.test(value),
		writeCutoff: vi.fn(async () => true),
		notifyPasswordChanged: vi.fn(),
		clearLoginLockout: vi.fn(async () => undefined),
		audit: vi.fn(),
		...extra,
	};
	return { flows: createLinkFlows(deps), api, totalCalls, deps };
}

describe('verifyEmail (C1)', () => {
	it('confirms a valid signup link through GoTrue /verify', async () => {
		const { flows, api } = setup({ verify: async () => ok({ access_token: 'x' }) });
		const result = await flows.verifyEmail(link('signup'));
		expect(result.status).toBe(200);
		expect(api.verify).toHaveBeenCalledWith('signup', HASH);
	});

	it.each([
		['an expired link', () => link('signup', NOW - 1), 'link_expired'],
		['a link at its exact exp', () => link('signup', NOW), 'link_expired'],
		['a tampered exp', () => ({ ...link('signup'), exp: String(NOW + 99_999) }), 'link_invalid'],
		['a foreign key', () => link('signup', NOW + 600, 'z'.repeat(48)), 'link_invalid'],
		['a recovery link', () => link('recovery'), 'link_invalid'],
		['no fields at all', () => ({}), 'link_invalid'],
	])('answers 410 to %s and never calls GoTrue', async (_label, fields, code) => {
		const { flows, totalCalls } = setup();
		const result = await flows.verifyEmail(fields());
		expect(result).toMatchObject({ status: 410, body: { error: code } });
		expect(totalCalls()).toBe(0);
	});

	it('answers 410 link_used when GoTrue refuses the token (used, superseded or expired there)', async () => {
		const { flows } = setup({ verify: async () => fail(403, { error_code: 'otp_expired' }) });
		expect(await flows.verifyEmail(link('signup'))).toMatchObject({ status: 410, body: { error: 'link_used' } });
	});

	it('answers 502 when GoTrue is unreachable, so the page does not call a good link dead', async () => {
		const { flows } = setup({ verify: async () => fail(0) });
		expect(await flows.verifyEmail(link('signup'))).toMatchObject({ status: 502, body: { error: 'auth_unavailable' } });
	});

	it('answers 503 and calls nothing when no signing key is configured', async () => {
		const { flows, totalCalls } = setup({}, { linkKey: '' });
		expect(await flows.verifyEmail(link('signup'))).toMatchObject({ status: 503, body: { error: 'link_signing_unconfigured' } });
		expect(totalCalls()).toBe(0);
	});
});

describe('resetPassword (C1, C4, C8)', () => {
	it('refuses an expired or tampered recovery link with 410 and 0 GoTrue calls', async () => {
		for (const fields of [link('recovery', NOW - 5), { ...link('recovery'), sig: link('recovery', NOW + 601).sig }, link('signup')]) {
			const { flows, totalCalls } = setup();
			const result = await flows.resetPassword({ ...fields, password: PASSWORD });
			expect(result.status).toBe(410);
			expect(totalCalls()).toBe(0);
		}
	});

	it('refuses a weak password before the link is spent', async () => {
		const { flows, totalCalls } = setup();
		expect(await flows.resetPassword({ ...link('recovery'), password: 'short' })).toMatchObject({ status: 422, body: { error: 'weak_password' } });
		expect(totalCalls()).toBe(0);
	});

	it('verifies, sets the password, signs out everywhere, writes the cut-off, then mails the notice', async () => {
		const { flows, api, deps } = setup();
		const result = await flows.resetPassword({ ...link('recovery'), password: PASSWORD });
		expect(result).toMatchObject({ status: 200, body: { signed_out_everywhere: true } });
		expect(api.verify).toHaveBeenCalledWith('recovery', HASH);
		expect(api.updatePassword).toHaveBeenCalledWith('aal1-token', PASSWORD);
		expect(api.logout).toHaveBeenCalledWith('aal1-token', 'global');
		expect(deps.writeCutoff).toHaveBeenCalledWith('user-1', new Date(NOW_MS).toISOString());
		expect(deps.notifyPasswordChanged).toHaveBeenCalledWith('ines@arlet.test');
		const order = [api.updatePassword, api.logout, deps.writeCutoff, deps.notifyPasswordChanged].map((fn) => fn.mock.invocationCallOrder[0]);
		expect(order).toEqual([...order].sort((left, right) => left - right));
	});

	it('lifts the sign-in lockout of the reset account: the lockout message says to reset, so a reset must work', async () => {
		const { flows, deps } = setup();
		await flows.resetPassword({ ...link('recovery'), password: PASSWORD });
		expect(deps.clearLoginLockout).toHaveBeenCalledWith('ines@arlet.test');
		const refused = setup({ updatePassword: async () => fail(422, { msg: 'Password is known to be weak' } as any) });
		await refused.flows.resetPassword({ ...link('recovery'), password: PASSWORD });
		expect(refused.deps.clearLoginLockout).not.toHaveBeenCalled();
	});

	it('leaves the mailbox proof only after a complete sign-out and cut-off (C341)', async () => {
		const { flows, api } = setup();
		await flows.resetPassword({ ...link('recovery'), password: PASSWORD });
		expect(api.updateUser).toHaveBeenCalledWith('user-1', { app_metadata: { mailbox_proof: { at: new Date(NOW_MS).toISOString(), email: 'ines@arlet.test', by: 'password_reset' } } });
		const partial = setup({ logout: async () => fail(500) });
		await partial.flows.resetPassword({ ...link('recovery'), password: PASSWORD });
		expect(partial.api.updateUser).not.toHaveBeenCalled();
	});

	it('keeps the reset when the proof write fails, and audits it', async () => {
		const { flows, deps } = setup({ updateUser: async () => fail(500) });
		expect(await flows.resetPassword({ ...link('recovery'), password: PASSWORD })).toMatchObject({ status: 200, body: { signed_out_everywhere: true } });
		expect(deps.audit).toHaveBeenCalledWith('password_reset_marker_failed', { user_id: 'user-1', status: 500 });
	});

	it('confirms a signup without writing a proof', async () => {
		const { flows, api } = setup({ verify: async () => ok({ access_token: 'x', user: { id: 'user-1', email: 'ines@arlet.test' } }) });
		await flows.verifyEmail(link('signup'));
		expect(api.updateUser).not.toHaveBeenCalled();
	});

	it('still answers 200 when the cut-off write fails, says so, and audits it', async () => {
		const { flows, deps } = setup({}, { writeCutoff: vi.fn(async () => false) });
		const result = await flows.resetPassword({ ...link('recovery'), password: PASSWORD });
		expect(result).toMatchObject({ status: 200, body: { signed_out_everywhere: false } });
		expect(deps.writeCutoff).toHaveBeenCalledTimes(2);
		expect(deps.audit).toHaveBeenCalledWith('password_reset_cutoff_failed', expect.objectContaining({ user_id: 'user-1' }));
	});

	it('asks a TOTP user for the code (mfa_required) instead of changing the password at aal1', async () => {
		const { flows, api } = setup({ listFactors: async () => ok([{ id: 'f1', factor_type: 'totp', status: 'verified' }] as any) });
		const first = await flows.resetPassword({ ...link('recovery'), password: PASSWORD });
		expect(first).toMatchObject({ status: 401, body: { error: 'mfa_required' } });
		expect(typeof first.body.reset_ticket).toBe('string');
		expect(api.updatePassword).not.toHaveBeenCalled();
		expect(api.verify).toHaveBeenCalledTimes(1);
	});

	it('completes the reset at aal2 with the ticket and the code, without spending another link', async () => {
		const { flows, api } = setup({
			listFactors: async () => ok([{ id: 'f1', factor_type: 'totp', status: 'verified' }] as any),
			mfaChallenge: async () => ok({ id: 'ch1' }),
			mfaVerify: async () => ok({ access_token: 'aal2-token' }),
		});
		const first = await flows.resetPassword({ ...link('recovery'), password: PASSWORD });
		const second = await flows.resetPassword({ reset_ticket: first.body.reset_ticket, code: '123456', password: PASSWORD });
		expect(second.status).toBe(200);
		expect(api.verify).toHaveBeenCalledTimes(1);
		expect(api.mfaChallenge).toHaveBeenCalledWith('aal1-token', 'f1');
		expect(api.mfaVerify).toHaveBeenCalledWith('aal1-token', 'f1', 'ch1', '123456');
		expect(api.updatePassword).toHaveBeenCalledWith('aal2-token', PASSWORD);
		expect(api.logout).toHaveBeenCalledWith('aal2-token', 'global');
		const replay = await flows.resetPassword({ reset_ticket: first.body.reset_ticket, code: '123456', password: PASSWORD });
		expect(replay).toMatchObject({ status: 410, body: { error: 'reset_ticket_invalid' } });
	});

	it('keeps the ticket on a wrong code (mfa_invalid) and drops it after five attempts', async () => {
		const { flows } = setup({
			listFactors: async () => ok([{ id: 'f1', factor_type: 'totp', status: 'verified' }] as any),
			mfaChallenge: async () => ok({ id: 'ch1' }),
			mfaVerify: async () => fail(422, { error_code: 'mfa_verification_failed' }),
		});
		const { body } = await flows.resetPassword({ ...link('recovery'), password: PASSWORD });
		const codes = [];
		for (let attempt = 0; attempt < 6; attempt += 1) {
			codes.push((await flows.resetPassword({ reset_ticket: body.reset_ticket, code: '000000', password: PASSWORD })).body.error);
		}
		expect(codes).toEqual(['mfa_invalid', 'mfa_invalid', 'mfa_invalid', 'mfa_invalid', 'mfa_invalid', 'reset_ticket_invalid']);
	});

	it('treats GoTrue insufficient_aal as mfa_required when the factor lookup failed', async () => {
		let factorsCalls = 0;
		const { flows } = setup({
			listFactors: async () => (factorsCalls++ === 0 ? fail(0) : ok([{ id: 'f9', factor_type: 'totp', status: 'verified' }] as any)),
			updatePassword: async () => fail(401, { error_code: 'insufficient_aal', msg: 'AAL2 session is required' }),
		});
		expect(await flows.resetPassword({ ...link('recovery'), password: PASSWORD })).toMatchObject({ status: 401, body: { error: 'mfa_required' } });
	});

	it('lets the user pick another password with the ticket when GoTrue rejects the first', async () => {
		let attempt = 0;
		const { flows, api } = setup({ updatePassword: async () => (attempt++ === 0 ? fail(422, { error_code: 'same_password', msg: 'New password should be different.' }) : ok({})) });
		const first = await flows.resetPassword({ ...link('recovery'), password: PASSWORD });
		expect(first).toMatchObject({ status: 422, body: { error: 'password_rejected', message: 'New password should be different.' } });
		const second = await flows.resetPassword({ reset_ticket: first.body.reset_ticket, password: 'Other-Pass-2026!' });
		expect(second.status).toBe(200);
		expect(api.verify).toHaveBeenCalledTimes(1);
	});

	it('refuses an unknown ticket with 410 and no GoTrue call', async () => {
		const { flows, totalCalls } = setup();
		expect(await flows.resetPassword({ reset_ticket: 'not-a-ticket', password: PASSWORD })).toMatchObject({ status: 410, body: { error: 'reset_ticket_invalid' } });
		expect(totalCalls()).toBe(0);
	});
});
