/**
 * The account input rules and the one hash used to key per-account state, shared by the
 * gateway and the account flows so each rule exists once.
 */
import { createHash } from 'node:crypto';

const EMAIL_ATEXT = "A-Za-z0-9!#$%&'*+/=?^_`{|}~-";
const EMAIL_LOCAL_PART = String.raw`(?:[${EMAIL_ATEXT}]+(?:\.[${EMAIL_ATEXT}]+)*|"[^"\r\n]+")`;
const EMAIL_DOMAIN_LABEL = '(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)';

export const EMAIL_REGEX = new RegExp(String.raw`^${EMAIL_LOCAL_PART}@(?:${EMAIL_DOMAIN_LABEL}\.)+[A-Za-z]{2,63}$`);
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const USERNAME_REGEX = /^\w[\w.-]{2,31}$/;

export function normalizeEmail(value) {
	return String(value ?? '').trim().toLowerCase();
}

/** A short, non-reversible key for per-account store entries (never the address itself). */
export function keyHash(value) {
	return createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 32);
}
