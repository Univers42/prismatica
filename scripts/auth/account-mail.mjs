/**
 * The endpoints that mail an address: /recover, /resend-verification and /register.
 *
 * Each answers at once with one body that does not depend on the account (verdict B, C5);
 * the lookup, GoTrue's generate_link and the send run afterwards in the bounded queue (C6).
 * Before anything is queued, one per-address bucket shared by all three, keyHash(lowercased
 * trimmed address), is taken: past 3 per hour the request is silently dropped behind the same
 * answer (C7). /register mails "you already have an account" to a taken address and answers
 * like a new one (DECISIONS D-028, Q6). Links carry GoTrue's hashed_token, never its
 * action_link, which Kong's key-auth blocks (R4).
 *
 * Caveat: the bucket counts requests, not mails: an attacker who knows an address can spend
 * its 3 per hour, and the owner's own request then sends nothing (stated in DECISIONS, C7).
 */
import { EMAIL_REGEX, keyHash, normalizeEmail } from './identity.mjs';

export const ACCOUNT_MAIL_ACCEPTED = Object.freeze({ message: 'If an account can receive mail at that address, a message is on its way. Check your inbox.' });
export const REGISTER_ACCEPTED = Object.freeze({ message: 'Check your inbox to finish creating your account.' });
export const ADDRESS_MAIL_LIMIT = 3;
export const ADDRESS_MAIL_WINDOW_SEC = 3_600;

export function addressBucketKey(email) {
	return `rl:account-mail:${keyHash(normalizeEmail(email))}`;
}

/** GoTrue's hashed_token, flat or under `properties`; '' when absent. Never the action_link. */
export function tokenHashFrom(payload) {
	const candidates = [payload?.hashed_token, payload?.properties?.hashed_token, payload?.token_hash, payload?.properties?.token_hash];
	return candidates.find((value) => typeof value === 'string' && value.length > 0) ?? '';
}

function isEmailTaken(result) {
	const text = String(result.body?.msg ?? result.body?.message ?? '');
	return result.status === 422 && (result.body?.error_code === 'email_exists' || /already (been )?registered|already exists/i.test(text));
}

export function createAccountMail({ store, queue, gotrue, mailer, render, links, siteUrl, profiles, isDeliverable, audit, newsletterOptIn }) {
	async function accept(kind, email, job) {
		const count = await store.incrWithTtl(addressBucketKey(email), ADDRESS_MAIL_WINDOW_SEC);
		if (count > ADDRESS_MAIL_LIMIT) {
			audit('account_mail_throttled', { email, kind });
			return;
		}
		queue.push(kind, job);
	}

	async function sendMessage(email, name, vars, event) {
		await mailer.send({ to: email, ...render(name, { email, siteUrl, ...vars }) });
		audit(event, { email });
	}

	/** A signed link for GoTrue's generate_link answer, or '' (audited) when there is none. */
	function signedLink(type, email, result, event) {
		const tokenHash = result.ok ? tokenHashFrom(result.body) : '';
		if (!tokenHash) audit(event, { email, status: result.status, reason: result.ok ? 'no_hashed_token' : 'generate_link_refused' });
		return tokenHash ? links.url(type, tokenHash) : '';
	}

	async function recoveryJob(email) {
		if (!links.configured || !(await isDeliverable(email))) return;
		const url = signedLink('recovery', email, await gotrue.generateLink({ type: 'recovery', email }), 'password_recovery_link_failed');
		if (url) await sendMessage(email, 'resetPassword', { link: url, expiresIn: links.expiresIn('recovery') }, 'password_recovery_email_sent');
	}

	// No password and no metadata: generate_link must not overwrite what the user chose at
	// sign-up (C3), and an address without a profile is never sent to GoTrue at all.
	async function resendJob(email) {
		if (!links.configured || !(await profiles.emailExists(email))) return;
		const url = signedLink('signup', email, await gotrue.generateLink({ type: 'signup', email }), 'verification_resend_link_failed');
		if (url) await sendMessage(email, 'confirmEmail', { link: url, expiresIn: links.expiresIn('signup') }, 'email_verification_sent');
	}

	async function registerJob(context) {
		const { email } = context;
		if (await profiles.emailExists(email)) return sendMessage(email, 'accountExists', {}, 'account_exists_email_sent');
		const result = await gotrue.generateLink({ type: 'signup', email, password: context.password, data: context.userMetadata });
		if (isEmailTaken(result)) return sendMessage(email, 'accountExists', {}, 'account_exists_email_sent');
		const url = signedLink('signup', email, result, 'register_failed');
		if (!url) return undefined;
		if (!(await profiles.create(context))) audit('register_profile_failed', { email });
		await sendMessage(email, 'confirmEmail', { link: url, expiresIn: links.expiresIn('signup') }, 'email_verification_sent');
		if (context.profile.newsletter_consent) await newsletterOptIn(email);
		return undefined;
	}

	return {
		async requestRecovery(rawEmail) {
			const email = normalizeEmail(rawEmail);
			if (EMAIL_REGEX.test(email)) await accept('recovery', email, () => recoveryJob(email));
			return { status: 202, body: ACCOUNT_MAIL_ACCEPTED };
		},

		async requestVerificationResend(rawEmail) {
			const email = normalizeEmail(rawEmail);
			if (EMAIL_REGEX.test(email)) await accept('resend-verification', email, () => resendJob(email));
			return { status: 202, body: ACCOUNT_MAIL_ACCEPTED };
		},

		/** `context` is already validated by the gateway (shape, policy, deliverable domain). */
		async requestRegistration(context) {
			if (await profiles.usernameTaken(context.profile.username)) return { status: 409, body: { error: 'username_taken', message: 'This username is already taken.' } };
			if (!links.configured) return { status: 503, body: { error: 'link_signing_unconfigured', message: 'Email verification is not configured.' } };
			await accept('register', context.email, () => registerJob(context));
			return { status: 202, body: REGISTER_ACCEPTED };
		},

		/** A security notice: always sent, so it takes no slot from the address bucket. */
		schedulePasswordChanged(email, changedAt) {
			queue.push('password-changed', () => sendMessage(email, 'passwordChanged', { changedAt }, 'password_changed_email_sent'));
		},

		/** The verification-off (local only) path's answer to a taken address: the same mail. */
		async scheduleAccountExists(email) {
			await accept('register', email, () => sendMessage(email, 'accountExists', {}, 'account_exists_email_sent'));
		},
	};
}
