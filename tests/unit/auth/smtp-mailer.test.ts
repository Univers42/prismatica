// @vitest-environment node
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { buildMimeMessage, createSmtpMailer } from '../../../scripts/auth/smtp-mailer.mjs';
import { smtpConfigFromEnv } from '../../../scripts/auth/smtp-config.mjs';

type Session = { ehlo: string; data: string; mailFrom: string; rcpt: string };

/** A minimal SMTP listener: records each session; `delayMs` holds the DATA answer open. */
function fakeSmtp(delayMs = 0) {
	const sessions: Session[] = [];
	let live = 0;
	let most = 0;
	const server = net.createServer((socket) => {
		live += 1;
		most = Math.max(most, live);
		const session: Session = { ehlo: '', data: '', mailFrom: '', rcpt: '' };
		sessions.push(session);
		let buffer = '';
		let inData = false;
		socket.on('close', () => {
			live -= 1;
		});
		socket.write('220 fake ESMTP\r\n');
		socket.on('data', (chunk) => {
			buffer += chunk.toString('utf8');
			for (;;) {
				if (inData) {
					const end = buffer.indexOf('\r\n.\r\n');
					if (end < 0) return;
					session.data = buffer.slice(0, end);
					buffer = buffer.slice(end + 5);
					inData = false;
					setTimeout(() => socket.write('250 queued\r\n'), delayMs);
					continue;
				}
				const index = buffer.indexOf('\r\n');
				if (index < 0) return;
				const line = buffer.slice(0, index);
				buffer = buffer.slice(index + 2);
				if (line.startsWith('EHLO ')) {
					session.ehlo = line.slice(5);
					socket.write('250-fake\r\n250 OK\r\n');
				} else if (line.startsWith('MAIL FROM:')) {
					session.mailFrom = line;
					socket.write('250 OK\r\n');
				} else if (line.startsWith('RCPT TO:')) {
					session.rcpt = line;
					socket.write('250 OK\r\n');
				} else if (line === 'DATA') {
					inData = true;
					socket.write('354 go\r\n');
				} else if (line === 'QUIT') {
					socket.end('221 bye\r\n');
				} else socket.write('500 what\r\n');
			}
		});
	});
	return new Promise<{ port: number; sessions: Session[]; most: () => number; close: () => Promise<void> }>((resolveServer) => {
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address() as net.AddressInfo;
			resolveServer({ port, sessions, most: () => most, close: () => new Promise((done) => server.close(() => done())) });
		});
	});
}

const decode = (part: string) => Buffer.from(part.replaceAll(/\s+/g, ''), 'base64').toString('utf8');
let close: (() => Promise<void>) | null = null;
afterEach(async () => {
	await close?.();
	close = null;
});

describe('createSmtpMailer', () => {
	it('says EHLO with, and stamps the Message-ID in, the domain of EMAIL_FROM', async () => {
		const server = await fakeSmtp();
		close = server.close;
		const smtp = smtpConfigFromEnv({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.port), EMAIL_FROM: 'no-reply@mail.prismatica.example' });
		await createSmtpMailer(smtp).send({ to: 'ines@arlet.test', subject: 'Confirm your email', html: '<p>hi</p>', text: 'hi' });
		const [session] = server.sessions;
		expect(session.ehlo).toBe('mail.prismatica.example');
		expect(session.mailFrom).toBe('MAIL FROM:<no-reply@mail.prismatica.example>');
		expect(session.rcpt).toBe('RCPT TO:<ines@arlet.test>');
		expect(session.data).toMatch(/^Message-ID: <[0-9a-f-]{36}@mail\.prismatica\.example>$/m);
		expect(session.data).toContain('From: Prismatica <no-reply@mail.prismatica.example>');
		expect(session.data).not.toContain('prismatica.local');
	});

	it('never holds more than two SMTP sessions open, however many sends are in flight', async () => {
		const server = await fakeSmtp(20);
		close = server.close;
		const smtp = smtpConfigFromEnv({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.port), EMAIL_FROM: 'n@x.example' });
		const mailer = createSmtpMailer(smtp, { maxSessions: 2 });
		await Promise.all(Array.from({ length: 8 }, (_, index) => mailer.send({ to: `u${index}@x.example`, subject: 's', html: '<p>x</p>' })));
		expect(server.sessions).toHaveLength(8);
		expect(server.most()).toBe(2);
	});

	it('refuses a recipient that could inject a header or a second RCPT', async () => {
		const smtp = smtpConfigFromEnv({ SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', EMAIL_FROM: 'n@x.example' });
		await expect(createSmtpMailer(smtp).send({ to: 'a@x.example>\r\nRCPT TO:<b@x.example', subject: 's', html: 'x' })).rejects.toThrow(/recipient/);
	});

	it('rejects (never hangs) when the server is unreachable', async () => {
		const smtp = smtpConfigFromEnv({ SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', EMAIL_FROM: 'n@x.example' });
		await expect(createSmtpMailer(smtp, { timeoutMs: 500 }).send({ to: 'a@x.example', subject: 's', html: 'x' })).rejects.toThrow();
	});
});

describe('buildMimeMessage', () => {
	const smtp = smtpConfigFromEnv({ EMAIL_FROM: 'no-reply@prismatica.example' });
	const fixed = { date: new Date(Date.UTC(2026, 9, 15, 12, 0, 0)), id: '00000000-0000-4000-8000-000000000000', boundary: 'b-fixed' };

	it('sends a text part and an HTML part, each base64 in lines of at most 76 characters', () => {
		const html = `<p>${'é'.repeat(200)}</p>\n.starts-with-a-dot`;
		const raw = buildMimeMessage(smtp, { to: 'a@x.example', subject: 'Reset your password', html, text: 'plain text' }, fixed);
		expect(raw).toContain('Content-Type: multipart/alternative; boundary="b-fixed"');
		const parts = raw.split('--b-fixed').slice(1, 3);
		expect(decode(parts[0].split('\r\n\r\n')[1])).toBe('plain text');
		expect(decode(parts[1].split('\r\n\r\n')[1])).toBe(html);
		for (const line of raw.split('\r\n')) {
			expect(line.length).toBeLessThanOrEqual(998);
			expect(line.startsWith('.')).toBe(false);
		}
		expect(Math.max(...parts[1].split('\r\n\r\n')[1].trim().split('\r\n').map((line) => line.length))).toBeLessThanOrEqual(76);
	});

	it('encodes a non-ASCII subject (RFC 2047) and strips CR/LF from it', () => {
		const raw = buildMimeMessage(smtp, { to: 'a@x.example', subject: 'Réinitialiser\r\nBcc: x@y', html: 'x' }, fixed);
		const subject = raw.split('\r\n').find((line) => line.startsWith('Subject: '));
		expect(subject).toMatch(/^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
		expect(raw).not.toMatch(/^Bcc:/m);
	});
});
