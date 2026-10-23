import { describe, expect, it, vi } from 'vitest';
import type { AuthResult } from '../../../src/hooks/useAuth';
import { passwordRuleResults } from '../../../src/lib/auth-validation';
import { bindResetPage } from '../../../src/scripts/auth-reset';

const LINK = '#token_hash=pkce_abc&type=recovery&exp=1792100000&sig=c2ln';
const FIELDS = { token_hash: 'pkce_abc', type: 'recovery', exp: '1792100000', sig: 'c2ln' };
const STRONG = 'Arlet!2026x';

function page(hash: string, answers: Array<AuthResult>) {
	const rules = passwordRuleResults('').map((rule) => `<li class="password-strength__rule is-unmet">${rule.label}</li>`).join('');
	document.body.innerHTML = `
		<main data-password-reset>
			<form data-reset-form data-when="form">
				<input name="password" type="password" />
				<div data-password-strength data-strength-level="empty"><span data-password-strength-label>Enter a password</span><ul data-password-rules>${rules}</ul></div>
				<input name="confirm_password" type="password" />
				<p data-password-match>Repeat the same password.</p>
				<div data-reset-code-field hidden><input name="code" /></div>
				<button type="submit" disabled>Change password</button>
			</form>
			<p data-auth-status role="status"></p>
			<button data-when="done" hidden>Sign in</button>
			<button data-when="refused" hidden>Ask for a new link</button>
		</main>`;
	const root = document.querySelector<HTMLElement>('[data-password-reset]')!;
	const resetPassword = vi.fn();
	answers.forEach((answer) => resetPassword.mockResolvedValueOnce(answer));
	const history = { state: null, replaceState: vi.fn() };
	bindResetPage(root, { resetPassword }, { hash, pathname: '/auth/reset-password', search: '' }, history);
	const form = root.querySelector<HTMLFormElement>('form')!;
	const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
	const type = (name: string, value: string) => {
		field(name).value = value;
		field(name).dispatchEvent(new Event('input'));
	};
	const submit = async () => {
		form.dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.waitFor(() => expect(form.querySelector('button')!.getAttribute('aria-busy')).not.toBe('true'));
	};
	const visible = () => Array.from(root.querySelectorAll<HTMLElement>('[data-when]')).filter((el) => !el.hidden).map((el) => el.dataset.when);
	const status = () => root.querySelector('[data-auth-status]')!;
	return { root, form, field, type, submit, visible, status, resetPassword, history };
}

describe('/auth/reset-password', () => {
	it('without a link, shows only the way to ask for a new one', () => {
		const p = page('', []);
		expect(p.visible()).toEqual(['refused']);
		expect(p.resetPassword).not.toHaveBeenCalled();
	});

	it('reads the link once and drops it from the address bar', () => {
		const p = page(LINK, []);
		expect(p.history.replaceState).toHaveBeenCalledWith(null, '', '/auth/reset-password');
		expect(p.visible()).toEqual(['form']);
	});

	it('keeps submit disabled until the password passes every rule and both fields match', () => {
		const p = page(LINK, []);
		const button = p.form.querySelector('button')!;
		p.type('password', 'weak');
		p.type('confirm_password', 'weak');
		expect(button.disabled).toBe(true);
		p.type('password', STRONG);
		expect(button.disabled).toBe(true);
		p.type('confirm_password', STRONG);
		expect(button.disabled).toBe(false);
	});

	it('updates the rule list in place, so typing never moves the layout', () => {
		const p = page(LINK, []);
		const before = Array.from(p.root.querySelectorAll('[data-password-rules] li'));
		p.type('password', 'abcdefgh');
		const after = Array.from(p.root.querySelectorAll('[data-password-rules] li'));
		expect(after).toEqual(before);
		expect(after.map((li) => li.classList.contains('is-met'))).toEqual(passwordRuleResults('abcdefgh').map((rule) => rule.passed));
	});

	it('posts the link with the password and shows sign-in when the reset is done', async () => {
		const p = page(LINK, [{ ok: true, status: 200, message: 'Your password was changed. Sign in again with the new password.' }]);
		p.type('password', STRONG);
		p.type('confirm_password', STRONG);
		await p.submit();
		expect(p.resetPassword).toHaveBeenCalledWith({ ...FIELDS, password: STRONG });
		expect(p.visible()).toEqual(['done']);
		expect(p.status().textContent).toContain('Your password was changed');
	});

	it('asks for the authenticator code and continues with the reset ticket alone', async () => {
		const p = page(LINK, [
			{ ok: false, status: 401, code: 'mfa_required', message: 'Enter the 6-digit code from your authenticator app.', resetTicket: 'ticket-1' },
			{ ok: true, status: 200, message: 'Your password was changed.' },
		]);
		p.type('password', STRONG);
		p.type('confirm_password', STRONG);
		await p.submit();
		const codeField = p.root.querySelector<HTMLElement>('[data-reset-code-field]')!;
		expect(codeField.hidden).toBe(false);
		expect(p.field('code').required).toBe(true);
		p.type('code', '123456');
		await p.submit();
		expect(p.resetPassword).toHaveBeenLastCalledWith({ reset_ticket: 'ticket-1', password: STRONG, code: '123456' });
		expect(p.visible()).toEqual(['done']);
	});

	it('keeps the form and the ticket when GoTrue rejects the password', async () => {
		const p = page(LINK, [
			{ ok: false, status: 422, code: 'password_rejected', message: 'Password is known to be weak.', resetTicket: 'ticket-2' },
			{ ok: true, status: 200, message: 'Your password was changed.' },
		]);
		p.type('password', STRONG);
		p.type('confirm_password', STRONG);
		await p.submit();
		expect(p.visible()).toEqual(['form']);
		expect(p.status().classList.contains('is-error')).toBe(true);
		p.type('password', `${STRONG}y`);
		p.type('confirm_password', `${STRONG}y`);
		await p.submit();
		expect(p.resetPassword).toHaveBeenLastCalledWith({ reset_ticket: 'ticket-2', password: `${STRONG}y` });
	});

	it('shows the way to a new link when the gateway refuses the link (410)', async () => {
		const p = page(LINK, [{ ok: false, status: 410, code: 'link_expired', message: 'This link has expired or is not valid. Ask for a new one.' }]);
		p.type('password', STRONG);
		p.type('confirm_password', STRONG);
		await p.submit();
		expect(p.visible()).toEqual(['refused']);
	});
});
