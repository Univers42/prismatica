// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hasSmtpConfig, smtpConfigFromEnv } from '../../../scripts/auth/smtp-config.mjs';

describe('smtpConfigFromEnv', () => {
	it("reads grobase's names: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM", () => {
		const smtp = smtpConfigFromEnv({ SMTP_HOST: 'smtp.mail.example', SMTP_PORT: '465', SMTP_USER: 'robot@mail.example', SMTP_PASS: 'pw', EMAIL_FROM: 'no-reply@mail.example' });
		expect(smtp).toMatchObject({ host: 'smtp.mail.example', port: 465, user: 'robot@mail.example', pass: 'pw', fromAddress: 'no-reply@mail.example', fromName: 'Prismatica' });
	});

	it('derives SMTP_SECURE from the port when it is unset: 465 TLS, 587 STARTTLS, else none', () => {
		expect(smtpConfigFromEnv({ SMTP_PORT: '465' }).secure).toBe('ssl');
		expect(smtpConfigFromEnv({ SMTP_PORT: '587' }).secure).toBe('starttls');
		expect(smtpConfigFromEnv({ SMTP_PORT: '1025' }).secure).toBe('none');
		expect(smtpConfigFromEnv({}).port).toBe(1025);
	});

	it('takes an explicit SMTP_SECURE over the port', () => {
		expect(smtpConfigFromEnv({ SMTP_PORT: '1025', SMTP_SECURE: 'true' }).secure).toBe('ssl');
		expect(smtpConfigFromEnv({ SMTP_PORT: '465', SMTP_SECURE: 'false' }).secure).toBe('none');
		expect(smtpConfigFromEnv({ SMTP_PORT: '2525', SMTP_SECURE: 'starttls' }).secure).toBe('starttls');
		expect(smtpConfigFromEnv({ SMTP_PORT: '587', SMTP_SECURE: '' }).secure).toBe('starttls');
	});

	it('ignores the old site-only names', () => {
		const smtp = smtpConfigFromEnv({ SMTP_USERNAME: 'old', SMTP_PASSWORD: 'old', SMTP_FROM_ADDRESS: 'old@old.example', SMTP_ENCRYPTION: 'ssl' });
		expect(smtp).toMatchObject({ user: '', pass: '', fromAddress: '', secure: 'none' });
	});

	it('keeps a display name given in EMAIL_FROM and derives the EHLO and Message-ID domain from its address', () => {
		const smtp = smtpConfigFromEnv({ EMAIL_FROM: '"Prismatica Team" <hello@Prismatica.Example>' });
		expect(smtp).toMatchObject({ fromName: 'Prismatica Team', fromAddress: 'hello@prismatica.example', mailDomain: 'prismatica.example' });
	});

	it('falls back to localhost for the mail domain when EMAIL_FROM has none', () => {
		expect(smtpConfigFromEnv({}).mailDomain).toBe('localhost');
	});

	it('strips CR and LF from every header-bound value', () => {
		const smtp = smtpConfigFromEnv({ EMAIL_FROM: 'Evil\r\nBcc: x@y.example <a@b.example>' });
		expect(smtp.fromName).not.toMatch(/[\r\n]/);
		expect(smtp.fromAddress).toBe('a@b.example');
	});
});

describe('hasSmtpConfig', () => {
	it('needs a host and a sender, and both credentials or neither', () => {
		expect(hasSmtpConfig(smtpConfigFromEnv({ SMTP_HOST: 'mailpit', EMAIL_FROM: 'n@x.example' }))).toBe(true);
		expect(hasSmtpConfig(smtpConfigFromEnv({ SMTP_HOST: 'mailpit' }))).toBe(false);
		expect(hasSmtpConfig(smtpConfigFromEnv({ EMAIL_FROM: 'n@x.example' }))).toBe(false);
		expect(hasSmtpConfig(smtpConfigFromEnv({ SMTP_HOST: 'h', EMAIL_FROM: 'n@x.example', SMTP_USER: 'u' }))).toBe(false);
		expect(hasSmtpConfig(smtpConfigFromEnv({ SMTP_HOST: 'h', EMAIL_FROM: 'n@x.example', SMTP_USER: 'u', SMTP_PASS: 'p' }))).toBe(true);
	});
});
