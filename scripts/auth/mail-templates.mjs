/**
 * The account e-mails, one source pair per message in src/email-templates (<file>.html and
 * <file>.txt). `{{name}}` is replaced by the caller's value: HTML-escaped in the HTML part,
 * as typed in the text part. A placeholder without a value throws, so a broken link never
 * leaves as a blank (the older renderer printed "unknown").
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const MESSAGES = Object.freeze({
	confirmEmail: { file: 'confirm-email', subject: 'Confirm your email' },
	resetPassword: { file: 'reset-password', subject: 'Reset your password' },
	passwordChanged: { file: 'password-changed', subject: 'Your password was changed' },
	accountExists: { file: 'account-exists', subject: 'You already have an account' },
});

const PLACEHOLDER = /\{\{\s*([A-Za-z][\w]*)\s*\}\}/g;

export function escapeHtml(value) {
	return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function fill(source, vars, encode, label) {
	return source.replaceAll(PLACEHOLDER, (_match, key) => {
		if (vars[key] === undefined || vars[key] === null) throw new Error(`${label} needs a value for {{${key}}}.`);
		return encode(String(vars[key]));
	});
}

/** @returns {{subject: string, html: string, text: string}} */
export function renderMessage(dir, name, vars) {
	const message = MESSAGES[name];
	if (!message) throw new Error(`Unknown message "${name}".`);
	const read = (extension) => readFileSync(resolve(dir, `${message.file}.${extension}`), 'utf8');
	return {
		subject: message.subject,
		html: fill(read('html'), vars, escapeHtml, `${message.file}.html`),
		text: fill(read('txt'), vars, (value) => value, `${message.file}.txt`),
	};
}
