/**
 * The gateway's SMTP settings, read under grobase's names (SMTP_HOST, SMTP_PORT, SMTP_USER,
 * SMTP_PASS, EMAIL_FROM, SMTP_SECURE; grobase orchestrators/compose/base/auth-api.yml), so one
 * vocabulary configures GoTrue and the site (PLAN §7.2, R5). The site's old names
 * (SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_ADDRESS, SMTP_ENCRYPTION, …) are not read.
 * The EHLO name and the Message-ID domain come from EMAIL_FROM's domain.
 */

const SECURE_WORDS = new Map([
	['ssl', 'ssl'], ['tls', 'ssl'], ['smtps', 'ssl'], ['true', 'ssl'], ['1', 'ssl'],
	['starttls', 'starttls'], ['start_tls', 'starttls'],
	['none', 'none'], ['plain', 'none'], ['false', 'none'], ['0', 'none'],
]);

function oneLine(value) {
	return String(value ?? '').replaceAll(/[\r\n]+/g, ' ').trim();
}

function secureMode(raw, port) {
	const word = SECURE_WORDS.get(String(raw ?? '').trim().toLowerCase());
	if (word) return word;
	if (port === 465) return 'ssl';
	if (port === 587) return 'starttls';
	return 'none';
}

function parseFrom(raw) {
	const value = oneLine(raw);
	const bracketed = /^(.*)<([^<>]+)>\s*$/.exec(value);
	const address = (bracketed ? bracketed[2] : value).trim().toLowerCase();
	const name = bracketed ? bracketed[1].trim().replace(/^"(.*)"$/, '$1').trim() : '';
	return { name, address: address.includes('@') ? address : '' };
}

export function smtpConfigFromEnv(env) {
	const port = Number(env.SMTP_PORT ?? 1025) || 1025;
	const from = parseFrom(env.EMAIL_FROM);
	return {
		host: oneLine(env.SMTP_HOST),
		port,
		secure: secureMode(env.SMTP_SECURE, port),
		user: String(env.SMTP_USER ?? ''),
		pass: String(env.SMTP_PASS ?? ''),
		fromName: from.name || 'Prismatica',
		fromAddress: from.address,
		mailDomain: from.address.split('@')[1] || 'localhost',
	};
}

/** A host, a sender, and either both credentials or neither. */
export function hasSmtpConfig(smtp) {
	const wantsAuth = Boolean(smtp.user || smtp.pass);
	return Boolean(smtp.host && smtp.fromAddress && (!wantsAuth || (smtp.user && smtp.pass)));
}
