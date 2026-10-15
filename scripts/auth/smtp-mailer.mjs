/**
 * The gateway's SMTP client (zero npm dependencies, node:net / node:tls). Moved out of
 * auth-gateway.mjs so it can be tested against a real socket.
 *   - At most `maxSessions` SMTP sessions are open at once (verdict B, C6); extra sends wait.
 *   - The EHLO name and the Message-ID domain are EMAIL_FROM's domain, never a hard-coded
 *     prismatica.local (PLAN §7.2).
 *   - Bodies are base64 in 76-column lines: no line can start with "." (no dot-stuffing
 *     needed) or pass SMTP's 998-character limit.
 *
 * Caveat: `timeoutMs` bounds each socket's idle time, not a whole send; a server that
 * trickles one byte per interval keeps a session open longer.
 */
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';

function createLimiter(max) {
	let active = 0;
	const waiting = [];
	return async function limited(task) {
		if (active >= max) await new Promise((resolveTurn) => waiting.push(resolveTurn));
		active += 1;
		try {
			return await task();
		} finally {
			active -= 1;
			waiting.shift()?.();
		}
	};
}

function base64Lines(text) {
	return Buffer.from(text, 'utf8').toString('base64').replaceAll(/.{1,76}/g, '$&\r\n').trimEnd();
}

function headerText(value) {
	const line = String(value ?? '').replaceAll(/[\r\n]+/g, ' ').trim();
	// RFC 2047 encoded-word for anything outside printable ASCII.
	return /^[\x20-\x7e]*$/.test(line) ? line : `=?UTF-8?B?${Buffer.from(line, 'utf8').toString('base64')}?=`;
}

function fromHeader(smtp) {
	const name = /^[A-Za-z0-9 ]+$/.test(smtp.fromName) ? smtp.fromName : `"${headerText(smtp.fromName).replaceAll(/["\\]/g, '')}"`;
	return `${name} <${smtp.fromAddress}>`;
}

/**
 * The DATA payload. `fixed` pins date, id and boundary for tests.
 * @param {ReturnType<typeof import('./smtp-config.mjs').smtpConfigFromEnv>} smtp
 * @param {{to: string, subject: string, html: string, text?: string}} message
 * @param {{date?: Date, id?: string, boundary?: string}} [fixed]
 */
export function buildMimeMessage(smtp, { to, subject, html, text }, fixed = {}) {
	const boundary = fixed.boundary ?? `prismatica-${randomUUID()}`;
	const headers = [
		`From: ${fromHeader(smtp)}`,
		`To: ${to}`,
		`Subject: ${headerText(subject)}`,
		`Date: ${(fixed.date ?? new Date()).toUTCString()}`,
		`Message-ID: <${fixed.id ?? randomUUID()}@${smtp.mailDomain}>`,
		'Auto-Submitted: auto-generated',
		'X-Auto-Response-Suppress: All',
		'MIME-Version: 1.0',
	];
	const htmlPart = ['Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', base64Lines(html)];
	if (!text) return [...headers, ...htmlPart].join('\r\n');
	return [
		...headers,
		`Content-Type: multipart/alternative; boundary="${boundary}"`,
		'',
		`--${boundary}`,
		'Content-Type: text/plain; charset=UTF-8',
		'Content-Transfer-Encoding: base64',
		'',
		base64Lines(text),
		`--${boundary}`,
		...htmlPart,
		`--${boundary}--`,
	].join('\r\n');
}

function lineReader(socket, timeoutMs) {
	socket.setEncoding('utf8');
	let buffer = '';
	const lines = [];
	const waiters = [];
	socket.on('data', (chunk) => {
		buffer += chunk;
		let index = buffer.indexOf('\n');
		while (index >= 0) {
			lines.push(buffer.slice(0, index).replace(/\r$/, ''));
			buffer = buffer.slice(index + 1);
			index = buffer.indexOf('\n');
		}
		while (lines.length > 0 && waiters.length > 0) waiters.shift()(lines.shift());
	});
	const readLine = () => new Promise((resolveLine, rejectLine) => {
		if (lines.length > 0) return resolveLine(lines.shift());
		const timer = setTimeout(() => rejectLine(new Error('SMTP read timed out.')), timeoutMs);
		waiters.push((line) => {
			clearTimeout(timer);
			resolveLine(line);
		});
	});
	async function reply() {
		for (;;) {
			const line = String(await readLine());
			if (/^\d{3} /.test(line)) return Number(line.slice(0, 3));
		}
	}
	async function send(line, expected) {
		socket.write(`${line}\r\n`);
		const code = await reply();
		if (!expected.includes(code)) throw new Error(`SMTP command failed with ${code}.`);
	}
	return { socket, reply, send };
}

function connect(smtp, timeoutMs, existing = null) {
	return new Promise((resolveSocket, rejectSocket) => {
		const target = { host: smtp.host, port: smtp.port };
		const secure = { servername: smtp.host, rejectUnauthorized: true };
		let socket;
		if (existing) socket = tls.connect({ socket: existing, ...secure }, () => resolveSocket(socket));
		else if (smtp.secure === 'ssl') socket = tls.connect({ ...target, ...secure }, () => resolveSocket(socket));
		else socket = net.connect(target, () => resolveSocket(socket));
		socket.setTimeout(timeoutMs, () => socket.destroy(new Error('SMTP connection timed out.')));
		socket.once('error', rejectSocket);
	});
}

async function authenticate(client, smtp) {
	if (!smtp.user && !smtp.pass) return;
	await client.send('AUTH LOGIN', [334]);
	await client.send(Buffer.from(smtp.user, 'utf8').toString('base64'), [334]);
	await client.send(Buffer.from(smtp.pass, 'utf8').toString('base64'), [235]);
}

async function deliver(smtp, message, timeoutMs) {
	let socket = await connect(smtp, timeoutMs);
	try {
		let client = lineReader(socket, timeoutMs);
		if ((await client.reply()) !== 220) throw new Error('SMTP greeting failed.');
		await client.send(`EHLO ${smtp.mailDomain}`, [250]);
		if (smtp.secure === 'starttls') {
			await client.send('STARTTLS', [220]);
			socket = await connect(smtp, timeoutMs, socket);
			client = lineReader(socket, timeoutMs);
			await client.send(`EHLO ${smtp.mailDomain}`, [250]);
		}
		await authenticate(client, smtp);
		await client.send(`MAIL FROM:<${smtp.fromAddress}>`, [250]);
		await client.send(`RCPT TO:<${message.to}>`, [250, 251]);
		await client.send('DATA', [354]);
		await client.send(`${buildMimeMessage(smtp, message)}\r\n.`, [250]);
		await client.send('QUIT', [221]).catch(() => undefined);
		// The slot is released on 'close', not on end(): a half-closed socket is still a
		// connection the server counts. The idle timeout above destroys one that never closes.
		await new Promise((resolveClosed) => {
			socket.once('close', resolveClosed);
			socket.end();
		});
	} catch (error) {
		socket.destroy();
		throw error;
	}
}

export function createSmtpMailer(smtp, { maxSessions = 2, timeoutMs = 15_000 } = {}) {
	const limited = createLimiter(maxSessions);
	return {
		/**
		 * Resolves once the server accepted the message; rejects on any SMTP or socket failure.
		 * @param {{to: string, subject: string, html: string, text?: string}} message
		 */
		send(message) {
			if (!/^[^\s<>@]+@[^\s<>@]+$/.test(String(message.to ?? ''))) {
				return Promise.reject(new Error('SMTP recipient is not a plain address.'));
			}
			return limited(() => deliver(smtp, message, timeoutMs));
		},
	};
}
