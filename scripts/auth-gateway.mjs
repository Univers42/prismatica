#!/usr/bin/env node
/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   auth-gateway.mjs                                   :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/10/25 12:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { resolve4, resolve6, resolveMx } from 'node:dns/promises';
import { createClient, MiniBaasError } from '@grobase/js';
import { createAccountMail, REGISTER_ACCEPTED } from './auth/account-mail.mjs';
import { createGotrueApi } from './auth/gotrue-api.mjs';
import { enforceStartupGuards, isProductionOrigin } from './auth/guards.mjs';
import { EMAIL_REGEX, keyHash, PASSWORD_REGEX, USERNAME_REGEX } from './auth/identity.mjs';
import { createLinkFlows } from './auth/link-flows.mjs';
import { approveRoutes } from './auth/approve-routes.mjs';
import { createLoginApprove, createSignInMailCap } from './auth/login-approve.mjs';
import { clearTicketCookie, createLoginOtp, ticketCookie, ticketFrom } from './auth/login-otp.mjs';
import { buildLinkUrl, humanDuration, linkSigningKeyProblem, linkTtls } from './auth/link-signing.mjs';
import { classifyLoginFailure } from './auth/login-failure.mjs';
import { escapeHtml, renderHtmlTemplate, renderMessage } from './auth/mail-templates.mjs';
import { loginAlertMailFields } from './auth/request-display.mjs';
import { deriveClientIp, ipBucket } from './auth/net-ip.mjs';
import { createSessionCutoffWriter } from './auth/session-cutoff.mjs';
import { createOauthLink, parseLinkMode } from './auth/oauth-link.mjs';
import { createSessionFlows, refreshCookie, refreshTokenFrom } from './auth/session-flows.mjs';
import { createEmailApiMailer, resolveMailTimeoutMs } from './auth/email-api-mailer.mjs';
import { createOtpClient } from './auth/otp-client.mjs';
import { enabledOauthProviders, isS256Challenge, oauthAuthorizeUrl } from './auth/oauth-providers.mjs';
import { createMailDailyCap, resolveMailDailyCap } from './auth/mail-daily-cap.mjs';
import { isNewsletterAllowed, isSignupAllowed, parseSignupAllowlist } from './auth/signup-allowlist.mjs';
import { createStore } from './auth/store.mjs';
import { parseVerificationExempt, isVerificationExempt, withExemptSuppression } from './auth/verification-exempt.mjs';
import { createWorkQueue } from './auth/work-queue.mjs';

for (const file of ['.env.local', '.env', '../../.env.local']) {
	const path = resolve(process.cwd(), file);
	if (!existsSync(path)) continue;
	for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#') || !line.includes('=')) continue;
		const [key, ...valueParts] = line.split('=');
		let value = valueParts.join('=').trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
		if (key && process.env[key] === undefined) process.env[key] = value;
	}
}

const config = {
	port: Number(process.env.AUTH_GATEWAY_PORT ?? 8787),
	baasUrl: (process.env.PUBLIC_BAAS_URL?.startsWith('/api') ? 'http://localhost:8000' : (process.env.PUBLIC_BAAS_URL ?? 'http://localhost:8000')).replace(/\/$/, ''),
	anonKey: process.env.PUBLIC_BAAS_ANON_KEY ?? process.env.KONG_PUBLIC_API_KEY ?? '',
	serviceKey: process.env.SERVICE_ROLE_KEY ?? process.env.KONG_SERVICE_API_KEY ?? process.env.BAAS_SERVICE_ROLE_KEY ?? '',
	turnstileSecret: process.env.TURNSTILE_SECRET_KEY ?? '',
	turnstileBypassLocal: process.env.TURNSTILE_BYPASS_LOCAL === 'true',
	demoInsecure: process.env.AUTH_DEMO_INSECURE === 'true',
	siteUrl: process.env.PUBLIC_SITE_URL ?? 'http://localhost:4322',
	linkTtls: linkTtls(process.env),
	mailQueueMax: Number(process.env.AUTH_MAIL_QUEUE_MAX ?? 500),
	emailDomainAllowlist: process.env.AUTH_EMAIL_DOMAIN_ALLOWLIST ?? process.env.EMAIL_DOMAIN_ALLOWLIST ?? '',
	requireEmailVerification: process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== 'false' && process.env.PUBLIC_AUTH_REQUIRE_EMAIL_VERIFICATION !== 'false',
	osionosBridgeUrl: (process.env.OSIONOS_BRIDGE_URL ?? 'http://localhost:4000/api/auth/bridge/session').replace(/\/$/, ''),
	osionosBridgeSecret: process.env.OSIONOS_BRIDGE_SHARED_SECRET ?? '',
	osionosAppUrl: (process.env.PUBLIC_OSIONOS_APP_URL ?? '').replace(/\/$/, ''),
	trustedProxyHops: Number(process.env.AUTH_TRUSTED_PROXY_HOPS ?? 0),
	trustCfConnectingIp: process.env.AUTH_TRUST_CF_CONNECTING_IP === 'true',
	redisUrl: process.env.REDIS_URL ?? process.env.AUTH_REDIS_URL ?? '',
	loginLockoutThreshold: Number(process.env.AUTH_LOGIN_LOCKOUT_THRESHOLD ?? 10),
	loginLockoutWindowSec: Number(process.env.AUTH_LOGIN_LOCKOUT_WINDOW_SEC ?? 900),
	loginLockoutSec: Number(process.env.AUTH_LOGIN_LOCKOUT_SEC ?? 900),
	loginEmailOtp: process.env.AUTH_LOGIN_EMAIL_OTP === 'true',
	signupAllowlist: process.env.AUTH_SIGNUP_ALLOWLIST ?? '',
	signupOpen: process.env.AUTH_SIGNUP_OPEN === 'true',
	verificationExempt: process.env.AUTH_VERIFICATION_EXEMPT ?? '',
	turnstileOptional: process.env.AUTH_TURNSTILE_OPTIONAL === 'true',
	registerHourlyLimit: Number(process.env.AUTH_REGISTER_RATE_LIMIT_PER_HOUR || 10),
	loginOtpResendGapSec: Number(process.env.AUTH_LOGIN_OTP_RESEND_GAP_SEC ?? 30),
	loginApproveLink: process.env.AUTH_LOGIN_EMAIL_OTP === 'true' && process.env.AUTH_LOGIN_APPROVE_LINK === 'true',
	// Throws at boot on a typo: a misspelt `on` must not silently run as off or as on.
	oauthLinkExisting: parseLinkMode(process.env.AUTH_OAUTH_LINK_EXISTING),
};
config.linkSigningKeyProblem = linkSigningKeyProblem(process.env.AUTH_LINK_SIGNING_KEY ?? '', [config.serviceKey, config.anonKey, config.osionosBridgeSecret, config.turnstileSecret, process.env.JWT_SECRET ?? '']);
config.mailDailyCap = resolveMailDailyCap(process.env.AUTH_MAIL_DAILY_CAP, isProductionOrigin(config.siteUrl));
// Caveat: exempt means the gateway sends that address no mail and signs it unverified; baas
// /auth/v1/recover and /otp still mail it through GoTrue's own SMTP, so whoever reads the inbox
// owns the account. Never admin, nothing private in it; guards.mjs refuses a malformed list at boot.
const verificationExempt = parseVerificationExempt(config.verificationExempt).addresses;
config.linkSigningKey = config.linkSigningKeyProblem ? '' : process.env.AUTH_LINK_SIGNING_KEY;

const store = createStore({ redisUrl: config.redisUrl, logger: console });
// otpResend is hourly (below Kong's 200/h on the grobase request route); the others are per minute.
const RATE_LIMITS = { login: 8, register: 12, recover: 12, resend: 12, verify: 20, reset: 10, newsletter: 12, otpVerify: 10, otpResend: 20, otpStatus: 120, otpApprove: 30, osionosSession: 30, oauthSession: 30 };
const RATE_WINDOWS_SEC = { otpResend: 3600 };
// Open signup swaps the per-minute register allowance for an hourly one: a mail cannon needs volume.
if (config.signupOpen && config.registerHourlyLimit > 0) {
	RATE_LIMITS.register = config.registerHourlyLimit;
	RATE_WINDOWS_SEC.register = 3600;
}
const RATE_WINDOW_SEC = 60;
const NEWSLETTER_TARGET_LIMIT = Number(process.env.AUTH_NEWSLETTER_TARGET_LIMIT ?? 3);
const NEWSLETTER_TARGET_WINDOW_SEC = 3600;
const SIGN_IN_NOTICE_TTL_SEC = 600;
const SUCCESS_NOTICE_TTL_SEC = 24 * 3600;
const MAIL_DOMAIN_CACHE_MS = 10 * 60 * 1000;
const DNS_LOOKUP_TIMEOUT_MS = 3500;
const GOTRUE_MANAGED_PROFILE_MARKER = 'managed-by-gotrue';
const emailTemplateDir = resolve(process.cwd(), 'src/email-templates');
const publicBaas = createClient({ url: config.baasUrl, anonKey: config.anonKey, persistSession: false });
const serviceBaas = config.serviceKey
	? createClient({ url: config.baasUrl, anonKey: config.anonKey || config.serviceKey, serviceRoleKey: config.serviceKey, accessToken: config.serviceKey, persistSession: false })
	: null;

function sdkResult(payload, status = 200) {
	return { response: { ok: status >= 200 && status < 300, status, statusText: '' }, payload: payload ?? {} };
}

function sdkErrorResult(error) {
	if (error instanceof MiniBaasError) {
		return { response: { ok: false, status: error.status, statusText: error.message }, payload: error.body ?? { message: error.message } };
	}
	return { response: { ok: false, status: 500, statusText: 'SDK request failed' }, payload: { message: error instanceof Error ? error.message : 'SDK request failed' } };
}

function clientIp(request) {
	return deriveClientIp(request, { trustedProxyHops: config.trustedProxyHops, trustCfConnectingIp: config.trustCfConnectingIp });
}

function json(response, status, body, headers = {}) {
	response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
	response.end(JSON.stringify(body));
}

function stableStringify(value) {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	const entries = Object.keys(value)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => JSON.stringify(key) + ':' + stableStringify(value[key]));
	return '{' + entries.join(',') + '}';
}

function bridgeSignature(timestamp, payload) {
	return createHmac('sha256', config.osionosBridgeSecret)
		.update(`${timestamp}.${stableStringify(payload)}`)
		.digest('hex');
}

function bearerToken(request) {
	const header = request.headers.authorization ?? '';
	const value = Array.isArray(header) ? header[0] : header;
	return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
}

async function readJson(request) {
	let body = '';
	for await (const chunk of request) {
		body += chunk;
		if (body.length > 32_768) throw Object.assign(new Error('Request body too large.'), { status: 413 });
	}
	return body ? JSON.parse(body) : {};
}

async function rateLimit(ip, action) {
	const limit = RATE_LIMITS[action] ?? 12;
	const windowSec = RATE_WINDOWS_SEC[action] ?? RATE_WINDOW_SEC;
	const key = `rl:${action}:${ipBucket(ip)}`;
	const count = await store.incrWithTtl(key, windowSec);
	if (count <= limit) return null;
	const remainingMs = await store.pttl(key);
	const baseRetry = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : windowSec;
	return baseRetry + Math.min((count - limit) * 2, 30);
}

function emailDomain(email) {
	return String(email).split('@').pop()?.toLowerCase() ?? '';
}

function csvValues(value) {
	return String(value ?? '').split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
}

// Only AUTH_EMAIL_DOMAIN_ALLOWLIST exempts a domain from the MX check; local test domains
// (mini-baas.local, example.test, localhost) are listed there, nothing is derived from a sender.
function allowedEmailDomains() {
	return new Set(csvValues(config.emailDomainAllowlist));
}

function isAllowedEmailDomain(email) {
	const domain = emailDomain(email);
	return domain ? allowedEmailDomains().has(domain) : false;
}

async function hasDeliverableEmailDomain(email) {
	if (isAllowedEmailDomain(email)) return true;
	const domain = emailDomain(email);
	const cacheKey = `mxcache:${domain}`;
	const cached = await store.get(cacheKey);
	if (cached !== null) return cached === '1';
	const timeout = new Promise((resolveTimeout) => globalThis.setTimeout(() => resolveTimeout(false), DNS_LOOKUP_TIMEOUT_MS));
	const lookup = Promise.allSettled([resolveMx(domain), resolve4(domain), resolve6(domain)]).then((results) => results.some((result) => result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length > 0));
	const valid = await Promise.race([lookup, timeout]);
	await store.set(cacheKey, valid ? '1' : '0', Math.floor(MAIL_DOMAIN_CACHE_MS / 1000));
	return valid;
}

// AUTH_TURNSTILE_OPTIONAL: the osionos bridge's login proxy sends a fixed token, so with no secret
// every app sign-in would be a 403. With a secret set it changes nothing.
// Caveat: with no secret and the flag on, there is no CAPTCHA at all; the per-IP limits and the
// e-mail proof are the only anti-abuse controls left.
async function verifyTurnstile(token, ip) {
	if (config.turnstileBypassLocal && (!token || token === 'localhost-turnstile-token')) return true;
	if (!config.turnstileSecret) return config.turnstileOptional;
	if (!token) return false;
	const form = new URLSearchParams({ secret: config.turnstileSecret, response: token, remoteip: ip });
	const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
	const payload = await response.json().catch(() => ({}));
	return payload?.success === true;
}

async function signInWithPassword(body) {
	try {
		return sdkResult(await publicBaas.auth.signInWithPassword(body));
	} catch (error) {
		return sdkErrorResult(error);
	}
}

async function signUpAccount(body) {
	try {
		return sdkResult(await publicBaas.auth.signUp(body));
	} catch (error) {
		return sdkErrorResult(error);
	}
}

async function createAdminUser(body) {
	try {
		if (!serviceBaas) throw new Error('Missing service role key.');
		return sdkResult(await serviceBaas.auth.admin.createUser(body));
	} catch (error) {
		return sdkErrorResult(error);
	}
}

async function updateAdminUser(userId, body) {
	try {
		if (!serviceBaas) throw new Error('Missing service role key.');
		return sdkResult(await serviceBaas.auth.admin.updateUser(userId, body));
	} catch (error) {
		return sdkErrorResult(error);
	}
}

async function localProfileExists(column, value) {
	if (!value || !serviceBaas) return false;
	return serviceBaas.from('users').exists({ filters: { [column]: value } });
}

// The newsletter RPCs are granted to service_role only: an anon grant let anyone request and
// confirm an opt-in for someone else's address with a token of their choosing.
async function serviceRpc(name, body) {
	if (!serviceBaas) return sdkErrorResult(new Error('The service key is not configured.'));
	try {
		return sdkResult(await serviceBaas.rpc(name, body, { apiKey: config.serviceKey, bearerToken: config.serviceKey }));
	} catch (error) {
		return sdkErrorResult(error);
	}
}

// The RPC has no ip/user-agent parameter and reads them from PostgREST request headers, which
// the gateway's own call to Kong does not carry (the column stays empty on b2b), so the client
// IP travels in details. Caveat: details.ip_address is not the ip_address column; PUB-1 must
// read details until the RPC takes the parameter. Events audited without a request carry none.
function requestAuditContext(request) {
	if (!request) return {};
	const userAgent = cleanText(request.headers?.['user-agent'], 256);
	return { ip_address: clientIp(request), ...(userAgent ? { user_agent: userAgent } : {}) };
}

async function audit(eventType, request, details = {}) {
	if (!serviceBaas || !config.serviceKey) return;
	await serviceBaas.rpc('auth_record_audit_event', { event_type: eventType, email: details.email ?? null, details: { ...requestAuditContext(request), ...details, request_id: randomUUID() } }, { apiKey: config.serviceKey, bearerToken: config.serviceKey }).catch((error) => {
		console.warn(`[auth-gateway] audit event "${eventType}" was not recorded: ${error instanceof Error ? error.message : 'unknown error'}`);
	});
}

function sanitizeAuthPayload(payload) {
	const safePayload = { ...payload };
	delete safePayload.refresh_token;
	return safePayload;
}

function humanAuthMessage(payload, fallback) {
	const candidates = [payload?.error_description, payload?.msg, payload?.message, payload?.error];
	const message = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
	return message ? message.trim().slice(0, 240) : fallback;
}

function headerValue(request, name, fallback = 'unknown', maxLength = 240) {
	const value = request.headers[name];
	const raw = Array.isArray(value) ? value.join(', ') : value;
	return cleanText(raw || fallback, maxLength) || fallback;
}

function isLocalIp(ip) {
	return ip === '::1' || ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('::ffff:127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

function loginLocation(request, ipAddress) {
	const city = headerValue(request, 'cf-ipcity', '', 80) || headerValue(request, 'x-vercel-ip-city', '', 80);
	const region = headerValue(request, 'cf-region', '', 80) || headerValue(request, 'x-vercel-ip-country-region', '', 80);
	const country = headerValue(request, 'cf-ipcountry', '', 80) || headerValue(request, 'x-vercel-ip-country', '', 80);
	const timeZone = headerValue(request, 'cf-timezone', '', 80);
	const location = [city, region, country].filter(Boolean).join(', ');
	if (location && timeZone) return `${location} (${timeZone})`;
	if (location) return location;
	return isLocalIp(ipAddress) ? 'Local development or private network' : 'Unknown location (no trusted proxy geolocation headers)';
}

function renderEmailTemplate(fileName, variables) {
	return renderHtmlTemplate(emailTemplateDir, fileName, variables);
}

function siteBaseUrl() {
	return config.siteUrl.replace(/\/$/, '');
}

function loginAlertContext(request, email, outcome = 'success') {
	const ipAddress = clientIp(request) || 'unknown';
	const occurredAt = new Intl.DateTimeFormat('en-GB', {
		dateStyle: 'full',
		timeStyle: 'long',
		timeZone: 'UTC',
	}).format(new Date());
	const headers = request.headers;
	const location = loginLocation(request, ipAddress);
	return {
		email,
		ipAddress,
		location,
		outcome: outcome === 'success' ? 'Successful sign-in' : 'Failed sign-in attempt',
		occurredAt: `${occurredAt} (UTC)`,
		siteUrl: siteBaseUrl(),
		mail: loginAlertMailFields({ headers, ipAddress, location, outcome }),
	};
}

// A success alert per sign-in spent 77 of the 50-mail daily cap on 2026-10-27, so it goes
// once per (address, client IP, user agent) a day; a new IP or browser still alerts at once.
// The key is written only after the mail is accepted, so a failed send suppresses nothing, and
// a store error sends the alert (fail open).
// Caveat: an attacker on the owner's IP (same NAT) with the owner's exact user agent, within
// 24h of the owner's own sign-in, gets no success alert; failed-attempt alerts are unaffected.
function signInNotice(request, email, outcome) {
	if (outcome !== 'success') return { key: `notice:${outcome}:${keyHash(email)}`, ttlSec: SIGN_IN_NOTICE_TTL_SEC };
	const client = keyHash(`${clientIp(request) || 'unknown'}|${request.headers?.['user-agent'] ?? ''}`);
	return { key: `notice:success:${keyHash(email)}:${client}`, ttlSec: SUCCESS_NOTICE_TTL_SEC };
}

async function signInNoticeRecentlySent(notice) {
	try {
		return (await store.get(notice.key)) !== null;
	} catch (error) {
		console.warn(`[auth-gateway] sign-in notice lookup failed, sending the alert: ${error instanceof Error ? error.message : 'unknown error'}`);
		return false;
	}
}

async function sendLoginSecurityNotification(email, outcome, context, notice, alwaysSend) {
	if (!mailConfigured()) {
		console.warn(`[auth-gateway] login security alert skipped for ${email}: the email service is not configured.`);
		await audit('login_alert_skipped', null, { email, reason: 'mail_not_configured' });
		return;
	}
	if (!alwaysSend && (await signInNoticeRecentlySent(notice))) {
		await audit('login_alert_suppressed', null, { email, outcome, reason: 'recent_notice_sent' });
		return;
	}
	const sendResult = await sendMail({
		to: email,
		subject: outcome === 'success' ? 'Security alert: new Prismatica sign-in' : 'Security alert: failed Prismatica sign-in attempt',
		html: renderEmailTemplate('login-alert.html', { ...context, ...context.mail }),
	});
	if (!wasSent(sendResult)) return;
	await store.set(notice.key, '1', notice.ttlSec).catch((error) => {
		console.warn(`[auth-gateway] sign-in notice key not stored: ${error instanceof Error ? error.message : 'unknown error'}`);
	});
	console.info(`[auth-gateway] login security alert accepted by the email service for ${email} from ${context.ipAddress}.`);
	await audit('login_alert_sent', null, { email, outcome, ip_address: context.ipAddress, location: context.location });
}

// A failed-login alert goes only to an existing profile; looking that up before answering
// told an attacker which addresses have accounts (verdict B, B2), so the lookup and the
// send run after the 401, in the queue (C5). A sign-in that removed a password always alerts (C373).
function scheduleLoginAlert(request, email, outcome, alwaysSend = false) {
	const context = loginAlertContext(request, email, outcome);
	const notice = signInNotice(request, email, outcome);
	mailQueue.push('login-alert', async () => {
		if (outcome === 'failed' && !(await localProfileExists('email', email))) return;
		await sendLoginSecurityNotification(email, outcome, context, notice, alwaysSend);
	});
}

async function sendAccountCreatedNotification(request, email) {
	if (!mailConfigured()) return;
	const sendResult = await sendMail({
		to: email,
		subject: 'Your Prismatica account is ready',
		html: renderEmailTemplate('account-created.html', { Email: email, SiteURL: siteBaseUrl() }),
	});
	if (wasSent(sendResult)) await audit('account_created_email_sent', request, { email });
}

async function sendNewsletterConfirm(request, email, token) {
	const sendResult = await sendMail({
		to: email,
		subject: 'Confirm your Prismatica newsletter subscription',
		html: renderEmailTemplate('newsletter-confirm.html', { Email: email, SiteURL: siteBaseUrl(), Token: token }),
	});
	if (wasSent(sendResult)) await audit('newsletter_confirmation_email_sent', request, { email });
}

async function sendNewsletterWelcome(request, email, token) {
	const sendResult = await sendMail({
		to: email,
		subject: 'Welcome to the Prismatica newsletter',
		html: renderEmailTemplate('newsletter-welcome.html', { Email: email, SiteURL: siteBaseUrl(), Token: token }),
	});
	if (wasSent(sendResult)) await audit('newsletter_welcome_email_sent', request, { email });
}

async function sendNewsletterUnsubscribe(request, email) {
	const sendResult = await sendMail({
		to: email,
		subject: 'You are unsubscribed from the Prismatica newsletter',
		html: renderEmailTemplate('newsletter-unsubscribe.html', { Email: email, SiteURL: siteBaseUrl() }),
	});
	if (wasSent(sendResult)) await audit('newsletter_unsubscribe_email_sent', request, { email });
}

function cleanText(value, maxLength) {
	return String(value ?? '').trim().slice(0, maxLength);
}

const signupAllowlist = parseSignupAllowlist(config.signupAllowlist);
const signupAllowed = (email) => isSignupAllowed(signupAllowlist, email);
const newsletterAllowed = (email) => isNewsletterAllowed(signupAllowlist, email, config.signupOpen);
const mailDailyCap = createMailDailyCap({ store, cap: config.mailDailyCap });
const emailMailer = createEmailApiMailer({ baseUrl: config.baasUrl, serviceKey: config.serviceKey, timeoutMs: resolveMailTimeoutMs(process.env.AUTH_MAIL_TIMEOUT_MS), dailyCap: mailDailyCap });

function mailConfigured() {
	return Boolean(config.serviceKey && config.baasUrl);
}

function sendThroughEmailService(message) {
	if (!mailConfigured()) return Promise.reject(Object.assign(new Error('The email service is not configured.'), { status: 503 }));
	return emailMailer.send(message);
}

// Flows report through this; it never rejects, so a fire-and-forget call cannot leak.
function flowAudit(eventType, details) {
	audit(eventType, null, details).catch(() => undefined);
}

// The one place a gateway mail can be withheld: every sender calls this, none calls the mailer.
const sendMail = withExemptSuppression(verificationExempt, sendThroughEmailService, flowAudit);
const wasSent = (sendResult) => sendResult?.suppressed !== true;

let droppedJobs = 0;
let lastDropReportMs = 0;
// Caveat: overflow is reported at most once a minute, as a count; drops after the last report
// stay unreported until the next one (a flood that stops leaves its tail in the counter).
function reportDroppedJob(label) {
	droppedJobs += 1;
	if (Date.now() - lastDropReportMs < 60_000) return;
	lastDropReportMs = Date.now();
	console.warn(`[auth-gateway] mail queue full: dropped ${droppedJobs} job(s), the last one "${label}".`);
	flowAudit('mail_queue_overflow', { dropped: droppedJobs, last: label });
	droppedJobs = 0;
}

const mailQueue = createWorkQueue({
	maxLength: config.mailQueueMax,
	concurrency: 2,
	onDrop: reportDroppedJob,
	onError: (error, label) => {
		console.error(`[auth-gateway] queued "${label}" failed: ${error instanceof Error ? error.message : 'unknown error'}`);
		flowAudit('mail_job_failed', { job: label, error: error instanceof Error ? error.message : 'unknown_error' });
	},
});

const gotrue = createGotrueApi({ baseUrl: config.baasUrl, anonKey: config.anonKey, serviceKey: config.serviceKey });

const accountMail = createAccountMail({
	store,
	queue: mailQueue,
	gotrue,
	mailer: { send: sendMail },
	render: (name, vars) => renderMessage(emailTemplateDir, name, vars),
	links: {
		configured: !config.linkSigningKeyProblem,
		url: (type, tokenHash) => buildLinkUrl(siteBaseUrl(), config.linkSigningKey, { type, tokenHash, exp: Math.floor(Date.now() / 1000) + linkTtlSec(type) }),
		expiresIn: (type) => humanDuration(linkTtlSec(type)),
	},
	siteUrl: siteBaseUrl(),
	profiles: {
		emailExists: (email) => localProfileExists('email', email),
		usernameTaken: (username) => localProfileExists('username', username),
		create: async (context) => (await createLocalUserProfile(context, false)).response.ok,
	},
	isDeliverable: hasDeliverableEmailDomain,
	audit: flowAudit,
	// Open signup proves an address for the account only; the newsletter keeps its own allowlist rule.
	newsletterOptIn: (email) => (newsletterAllowed(email) ? requestNewsletterOptIn(null, email) : undefined),
	signupAllowed,
});

const writeCutoff = createSessionCutoffWriter({ baasUrl: config.baasUrl, serviceKey: config.serviceKey });
const utcNow = () => `${new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'long', timeZone: 'UTC' }).format(new Date())} (UTC)`;

// One account's sign-in lockout: the lock and the failure count, keyed as the login handler reads them.
const loginLockKeys = (email) => {
	const hashed = keyHash(String(email ?? '').trim().toLowerCase());
	return { lock: `lock:login:${hashed}`, fail: `fail:login:${hashed}` };
};

async function clearLoginLockout(email) {
	const { lock, fail } = loginLockKeys(email);
	await Promise.all([store.del(lock), store.del(fail)]);
}

const linkFlows = createLinkFlows({
	gotrue,
	store,
	linkKey: config.linkSigningKey,
	nowMs: () => Date.now(),
	passwordAcceptable: (password) => PASSWORD_REGEX.test(password),
	writeCutoff,
	notifyPasswordChanged: (email) => accountMail.schedulePasswordChanged(email, utcNow()),
	clearLoginLockout,
	audit: flowAudit,
});

const oauthLink = createOauthLink({
	gotrue,
	store,
	writeCutoff,
	notifyLinked: (email, counts) => accountMail.scheduleAccountLinked(email, utcNow(), counts),
	audit: flowAudit,
	mode: config.oauthLinkExisting,
});

const sessionFlows = createSessionFlows({ gotrue, audit: flowAudit });

const mailCap = config.loginApproveLink ? createSignInMailCap({ store }) : undefined;

const loginOtp = createLoginOtp({
	store,
	otp: createOtpClient({ baseUrl: config.baasUrl, serviceKey: config.serviceKey }),
	sessions: sessionFlows,
	gotrue,
	signingKey: config.linkSigningKey,
	resendGapSec: config.loginOtpResendGapSec,
	audit: flowAudit,
	mailCap,
});

const loginApprove = config.loginApproveLink
	? createLoginApprove({
			otp: loginOtp,
			store,
			sessions: sessionFlows,
			mail: { send: sendMail, render: (name, vars) => renderMessage(emailTemplateDir, name, vars) },
			siteUrl: siteBaseUrl(),
			mailCap,
			lockLogin: (email) => store.set(loginLockKeys(email).lock, '1', config.loginLockoutSec),
			audit: flowAudit,
		})
	: null;

function linkTtlSec(type) {
	return type === 'signup' ? config.linkTtls.verifySec : config.linkTtls.resetSec;
}

function registrationProfile(payload) {
	const rawProfile = typeof payload.profile === 'object' && payload.profile !== null ? payload.profile : {};
	return {
		username: cleanText(rawProfile.username, 32),
		confirmPassword: String(rawProfile.confirmPassword ?? ''),
		email_verification_consent: rawProfile.emailVerificationConsent !== false,
		newsletter_consent: rawProfile.newsletterConsent === true,
		notifications_enabled: true,
	};
}

async function protectedAction(request, response, action, handler) {
	const ip = clientIp(request);
	const retryAfter = await rateLimit(ip, action);
	if (retryAfter) {
		json(response, 429, { message: 'Too many attempts. Please retry later.' }, { 'retry-after': String(retryAfter) });
		return;
	}
	const payload = await readJson(request);
	const validTurnstile = await verifyTurnstile(String(payload.turnstileToken ?? ''), ip);
	if (!validTurnstile) {
		await audit(`${action}_turnstile_failed`, request, { email: payload.email });
		json(response, 403, { message: 'Anti-abuse verification failed.' });
		return;
	}
	await handler(payload, ip);
}

function registrationContext(payload) {
	const email = String(payload.email ?? '').trim().toLowerCase();
	const password = String(payload.password ?? '');
	const profile = registrationProfile(payload);
	const userMetadata = {
		username: profile.username,
		theme: 'light',
		notifications_enabled: profile.notifications_enabled,
	};
	return { email, password, profile, userMetadata };
}

function isValidRegistrationContext({ email, password, profile }) {
	return EMAIL_REGEX.test(email)
		&& PASSWORD_REGEX.test(password)
		&& USERNAME_REGEX.test(profile.username)
		&& profile.confirmPassword === password
		&& (!config.requireEmailVerification || profile.email_verification_consent);
}

async function createDevConfirmedAccount({ email, password, userMetadata }) {
	const result = await createAdminUser({
		email,
		password,
		email_confirm: true,
		user_metadata: userMetadata,
	});
	if (result.response.status !== 405) return result;
	const signup = await signUpAccount({ email, password, data: userMetadata });
	const userId = signup.payload?.user?.id ?? signup.payload?.id;
	if (signup.response.ok && typeof userId === 'string') {
		await updateAdminUser(userId, { email_confirm: true }).catch(() => undefined);
	}
	return signup;
}

async function createLocalUserProfile({ email, profile }, isEmailVerified) {
	try {
		if (!serviceBaas) throw new Error('Missing service role key.');
		return sdkResult(await serviceBaas.from('users').insert({
			username: profile.username,
			email,
			password_hash: GOTRUE_MANAGED_PROFILE_MARKER,
			theme: 'light',
			notifications_enabled: profile.notifications_enabled,
			is_email_verified: isEmailVerified,
		}));
	} catch (error) {
		return sdkErrorResult(error);
	}
}

async function ensureLocalUserProfile(request, response, context, isEmailVerified) {
	const profile = await createLocalUserProfile(context, isEmailVerified);
	if (profile.response.ok) return true;
	await audit('register_failed', request, { email: context.email, status: profile.response.status, stage: 'local_profile' });
	const message = humanAuthMessage(profile.payload, 'Account was created, but the local profile could not be created.');
	json(response, profile.response.status === 409 ? 409 : 502, { message });
	return false;
}

// The verification-off path (local only: guards.mjs refuses it on a public origin). A new
// address is usable at once, so its 200 differs from a taken address's 202 by design here.
async function handleDevConfirmedRegistration(request, response, context) {
	if (await localProfileExists('username', context.profile.username)) {
		json(response, 409, { error: 'username_taken', message: 'This username is already taken.' });
		return;
	}
	if (!signupAllowed(context.email)) {
		flowAudit('signup_refused_allowlist', { email: context.email, source: 'register' });
		json(response, 200, { message: 'Development account created and confirmed. You can sign in now.' });
		return;
	}
	if (await localProfileExists('email', context.email)) {
		await accountMail.scheduleAccountExists(context.email);
		json(response, 202, REGISTER_ACCEPTED);
		return;
	}
	const result = await createDevConfirmedAccount(context);
	if (!result.response.ok) {
		await audit('register_dev_failed', request, { email: context.email, status: result.response.status });
		json(response, result.response.status, { message: humanAuthMessage(result.payload, 'Development registration failed.') });
		return;
	}
	if (!await ensureLocalUserProfile(request, response, context, true)) {
		return;
	}
	mailQueue.push('account-created', async () => {
		await sendAccountCreatedNotification(null, context.email);
		if (context.profile.newsletter_consent) await requestNewsletterOptIn(null, context.email);
	});
	await audit('register_dev_confirmed', request, { email: context.email });
	json(response, 200, { message: 'Development account created and confirmed. You can sign in now.' });
}

// An exempt address is never registered here (an admin creates it). The answer is a taken
// address's, so the list is not readable from outside; a taken username answers 409 as it does for everyone.
async function answerExemptRegistration(response, context) {
	if (await localProfileExists('username', context.profile.username)) {
		json(response, 409, { error: 'username_taken', message: 'This username is already taken.' });
		return;
	}
	// Not awaited: an audit round trip would make this answer slower than a taken address's.
	flowAudit('signup_refused_exempt', { email: context.email });
	json(response, 202, REGISTER_ACCEPTED);
}

async function handleRegister(request, response) {
	await protectedAction(request, response, 'register', async (payload) => {
		const context = registrationContext(payload);
		if (!isValidRegistrationContext(context)) {
			json(response, 422, { message: 'Invalid email or password policy.' });
			return;
		}
		if (!await hasDeliverableEmailDomain(context.email)) {
			json(response, 422, { message: 'Use an email domain that can receive mail.' });
			return;
		}
		if (!config.serviceKey || (config.requireEmailVerification && !mailConfigured())) {
			json(response, 503, { message: 'Email verification is not configured.' });
			return;
		}
		if (isVerificationExempt(verificationExempt, context.email)) {
			await answerExemptRegistration(response, context);
			return;
		}
		if (!config.requireEmailVerification || !context.profile.email_verification_consent) {
			await handleDevConfirmedRegistration(request, response, context);
			return;
		}
		const result = await accountMail.requestRegistration(context);
		json(response, result.status, result.body);
	});
}

async function handleLogin(request, response) {
	await protectedAction(request, response, 'login', async (payload, ip) => {
		const email = String(payload.email ?? '').trim().toLowerCase();
		const password = String(payload.password ?? '');
		if (!EMAIL_REGEX.test(email) || password.length === 0) {
			json(response, 422, { message: 'Invalid credentials.' });
			return;
		}
		const { lock: lockKey, fail: failKey } = loginLockKeys(email);
		const lockRemainingMs = await store.pttl(lockKey);
		if (lockRemainingMs > 0) {
			await audit('login_locked', request, { email, ip });
			console.warn(`[auth-gateway] login: ${email} is locked out for ${Math.ceil(lockRemainingMs / 1000)}s more; the password was not checked`);
			json(response, 429, { message: 'Too many failed attempts for this account. Try again later or reset your password.' }, { 'retry-after': String(Math.ceil(lockRemainingMs / 1000)) });
			return;
		}
		if (config.loginEmailOtp && !loginOtp.ready) {
			console.error('[auth-gateway] login: AUTH_LOGIN_EMAIL_OTP is on but AUTH_LINK_SIGNING_KEY is unusable; the password was not checked');
			json(response, 503, { message: 'Sign-in with an emailed code is not configured.' });
			return;
		}
		const result = await signInWithPassword({ email, password });
		await audit(result.response.ok ? 'login_success' : 'login_failed', request, { email, status: result.response.status });
		const failure = result.response.ok ? null : classifyLoginFailure(result.response.status, result.payload);
		if (failure === 'unconfirmed') {
			// GoTrue only says this after a correct password: no lockout count, no failed-login alert.
			await audit('login_email_unconfirmed', request, { email });
			json(response, 403, { error: 'email_not_confirmed', message: 'Confirm your email first — check your inbox, or send a new link.' });
			return;
		}
		if (failure === 'rate-limited') {
			json(response, 429, { message: 'Too many sign-in attempts reached the auth service. Wait a minute and try again.' });
			return;
		}
		if (failure === 'upstream') {
			// The password was never checked: no lockout count, no failed-login alert, and an
			// answer that does not depend on the email, so nothing about the account leaks.
			console.error(`[auth-gateway] login: the auth service at ${config.baasUrl} answered HTTP ${result.response.status} ${result.response.statusText}; the password was not checked`);
			json(response, 502, { message: `The sign-in service is unreachable or misconfigured (HTTP ${result.response.status}). Your password was not checked.` });
			return;
		}
		if (!result.response.ok) {
			const failures = await store.incrWithTtl(failKey, config.loginLockoutWindowSec);
			if (failures >= config.loginLockoutThreshold) {
				await store.set(lockKey, '1', config.loginLockoutSec);
				await store.del(failKey);
				await audit('login_lockout_triggered', request, { email, failures });
			}
			scheduleLoginAlert(request, email, 'failed');
			// Generic message and fixed 401 — never leak whether the email exists,
			// the lockout counter, or GoTrue internals to an unauthenticated caller. The operator's
			// log says what the caller may not: the password WAS checked, for which account.
			console.warn(`[auth-gateway] login: the auth service rejected the password for ${email} (HTTP ${result.response.status}; ${failures}/${config.loginLockoutThreshold} before a ${config.loginLockoutSec}s lockout)`);
			json(response, 401, { message: 'Invalid credentials.' });
			return;
		}
		await store.del(failKey);
		await store.del(lockKey);
		if (config.loginEmailOtp) {
			await handleLoginCodeStep(request, response, email, result.payload, ip);
			return;
		}
		scheduleLoginAlert(request, email, 'success');
		const refreshToken = typeof result.payload.refresh_token === 'string' ? result.payload.refresh_token : '';
		const headers = refreshToken ? { 'set-cookie': refreshCookie(refreshToken) } : {};
		json(response, 200, sanitizeAuthPayload(result.payload), headers);
	});
}

// The session exists in GoTrue but is withheld: no token, no refresh cookie, only the ticket cookie.
async function handleLoginCodeStep(request, response, email, grant, ip) {
	const refreshToken = typeof grant.refresh_token === 'string' ? grant.refresh_token : '';
	const userId = typeof grant.user?.id === 'string' ? grant.user.id : '';
	const login = { email, userId, refreshToken };
	let started = { ok: false, status: 503, message: 'The sign-in service returned no session.' };
	if (refreshToken) started = loginApprove ? await loginApprove.begin({ ...login, summary: approvalSummary(request, email), ip }) : await loginOtp.begin(login);
	if (!started.ok) {
		json(response, started.status, { message: started.message });
		return;
	}
	const body = loginApprove ? { mfa_required: 'email_approve', match: started.match } : { mfa_required: 'email_otp' };
	json(response, 200, body, { 'set-cookie': ticketCookie(started.ticket) });
}

// What the approver is asked to recognise; only display-safe text is stored or mailed.
function approvalSummary(request, email) {
	const { occurredAt, mail } = loginAlertContext(request, email);
	return { occurredAt, ipAddress: mail.ipAddress, location: mail.location, userAgent: mail.userAgent };
}

async function handleRecover(request, response) {
	await protectedAction(request, response, 'recover', async (payload) => {
		const result = await accountMail.requestRecovery(payload.email);
		json(response, result.status, result.body);
	});
}

async function handleResendVerification(request, response) {
	await protectedAction(request, response, 'resend', async (payload) => {
		const result = await accountMail.requestVerificationResend(payload.email);
		json(response, result.status, result.body);
	});
}

// The signed link is the credential here, so these take no Turnstile token; per-IP limits only.
async function linkAction(request, response, action, flow) {
	const retryAfter = await rateLimit(clientIp(request), action);
	if (retryAfter) {
		json(response, 429, { error: 'rate_limited', message: 'Too many attempts. Please retry later.' }, { 'retry-after': String(retryAfter) });
		return;
	}
	const result = await flow(await readJson(request));
	json(response, result.status, result.body);
}

async function handleVerify(request, response) {
	await linkAction(request, response, 'verify', (payload) => linkFlows.verifyEmail(payload));
}

async function handleResetPassword(request, response) {
	await linkAction(request, response, 'reset', (payload) => linkFlows.resetPassword(payload));
}

async function requestNewsletterOptIn(request, email) {
	const token = randomBytes(32).toString('hex');
	const result = await serviceRpc('gdpr_request_newsletter_optin', { email, token });
	if (!result.response.ok) {
		return {
			ok: false,
			status: result.response.status,
			message: humanAuthMessage(result.payload, 'Could not start the newsletter confirmation.'),
		};
	}
	try {
		await sendNewsletterConfirm(request, email, token);
	} catch (error) {
		console.error(`[auth-gateway] newsletter confirmation email failed for ${email}: ${error instanceof Error ? error.message : 'unknown error'}`);
		await audit('newsletter_confirmation_email_failed', request, { email, error: error instanceof Error ? error.message : 'unknown_error' });
		return {
			ok: false,
			status: 502,
			message: 'Could not send the newsletter confirmation email. Please try again in a moment.',
		};
	}
	await audit('newsletter_optin_requested', request, { email });
	return {
		ok: true,
		status: 200,
		message: `Check ${escapeHtml(email)} to confirm your subscription.`,
	};
}

async function handleNewsletterSubscribe(request, response) {
	await protectedAction(request, response, 'newsletter', async (payload) => {
		const email = String(payload.email ?? '').trim().toLowerCase();
		if (!EMAIL_REGEX.test(email)) {
			json(response, 422, { message: 'Use a valid email address.' });
			return;
		}
		// Same 200 and body as a sent confirmation, so the answer is no oracle for the list (SGN-3).
		if (!newsletterAllowed(email)) {
			await audit('signup_refused_allowlist', request, { email, source: 'newsletter' });
			json(response, 200, { message: `Check ${escapeHtml(email)} to confirm your subscription.` });
			return;
		}
		if (!await hasDeliverableEmailDomain(email)) {
			json(response, 422, { message: 'Use an email domain that can receive mail.' });
			return;
		}
		// Per-target cap: stop the newsletter from being used as an email-bomb
		// amplifier against a victim's inbox, independent of source IP rotation.
		const targetCount = await store.incrWithTtl(`rl:newsletter-target:${keyHash(email)}`, NEWSLETTER_TARGET_WINDOW_SEC);
		if (targetCount > NEWSLETTER_TARGET_LIMIT) {
			await audit('newsletter_target_throttled', request, { email });
			json(response, 429, { message: 'Too many confirmation emails were requested for this address. Please check your inbox or try again later.' });
			return;
		}
		const result = await requestNewsletterOptIn(request, email);
		json(response, result.status, { message: result.message });
	});
}

async function handleNewsletterConfirm(request, response) {
	const payload = await readJson(request);
	const token = String(payload.token ?? '').trim();
	if (!token) {
		json(response, 422, { message: 'Confirmation token is required.' });
		return;
	}
	const result = await serviceRpc('gdpr_confirm_newsletter_optin', { token });
	if (!result.response.ok) {
		json(response, result.response.status, { message: humanAuthMessage(result.payload, 'This confirmation link is invalid or expired.') });
		return;
	}
	const email = typeof result.payload?.email === 'string' ? result.payload.email : '';
	if (EMAIL_REGEX.test(email) && mailConfigured()) {
		await sendNewsletterWelcome(request, email, token).catch(async (error) => {
			console.error(`[auth-gateway] newsletter welcome failed for ${email}: ${error instanceof Error ? error.message : 'unknown error'}`);
			await audit('newsletter_welcome_email_failed', request, { email, error: error instanceof Error ? error.message : 'unknown_error' });
		});
	}
	json(response, 200, { message: 'Your newsletter subscription is confirmed. Thank you.' });
}

async function handleNewsletterUnsubscribe(request, response) {
	const payload = await readJson(request);
	const token = String(payload.token ?? '').trim();
	if (!token) {
		json(response, 422, { message: 'Unsubscribe token is required.' });
		return;
	}
	const result = await serviceRpc('gdpr_withdraw_consent', { consent_type: 'newsletter', token });
	if (!result.response.ok) {
		json(response, result.response.status, { message: humanAuthMessage(result.payload, 'This unsubscribe link is invalid or has already been used.') });
		return;
	}
	const email = typeof result.payload?.email === 'string' ? result.payload.email : '';
	if (EMAIL_REGEX.test(email) && mailConfigured()) {
		await sendNewsletterUnsubscribe(request, email).catch(async (error) => {
			console.error(`[auth-gateway] newsletter unsubscribe email failed for ${email}: ${error instanceof Error ? error.message : 'unknown error'}`);
			await audit('newsletter_unsubscribe_email_failed', request, { email, error: error instanceof Error ? error.message : 'unknown_error' });
		});
	}
	json(response, 200, { message: 'You have been unsubscribed from the Prismatica newsletter.' });
}

async function handleRefresh(request, response) {
	const result = await sessionFlows.refresh(refreshTokenFrom(request.headers.cookie));
	json(response, result.status, result.body, result.headers);
}

async function handleLogout(request, response) {
	const result = await sessionFlows.logout(refreshTokenFrom(request.headers.cookie));
	json(response, result.status, result.body, result.headers);
}

function handleHealth(_request, response) {
	json(response, 200, { status: 'ok' });
}

async function mintOsionosSession(request, response, options = {}) {
	const accessToken = typeof options.accessToken === 'string' ? options.accessToken : bearerToken(request);
	if (!accessToken) {
		json(response, 401, { message: 'Missing bearer token.' });
		return 'failed';
	}
	if (!config.osionosBridgeSecret) {
		json(response, 503, { message: 'osionos bridge is not configured.' });
		return 'failed';
	}

	const retryAfter = await rateLimit(clientIp(request), 'osionosSession');
	if (retryAfter) {
		json(response, 429, { error: 'rate_limited', message: 'Too many attempts. Please retry later.' }, { 'retry-after': String(retryAfter) });
		return 'failed';
	}

	const userClient = createClient({ url: config.baasUrl, anonKey: config.anonKey, accessToken, persistSession: false });
	let user;
	try {
		user = await userClient.auth.getUser();
	} catch {
		json(response, 401, { message: 'Invalid or expired Prismatica session.' });
		return 'failed';
	}

	const identityUnavailable = () => {
		json(response, 503, { error: 'oauth_identity_unavailable', message: 'Prismatica user identities are unavailable.' });
		return 'failed';
	};
	const identities = user?.identities;
	if (!Array.isArray(identities) || identities.length === 0) return identityUnavailable();
	// Fail closed before the one-identity shortcut: a malformed entry never proves a provider.
	if (!identities.every((identity) => identity !== null && typeof identity === 'object' && typeof identity.provider === 'string')) return identityUnavailable();

	const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
	const subject = typeof user.id === 'string' ? user.id : '';
	if (!subject || !EMAIL_REGEX.test(email)) {
		json(response, 422, { message: 'Prismatica user identity is incomplete.' });
		return 'failed';
	}

	const isUnverifiedIdentity = (identity) => {
		const provider = typeof identity?.provider === 'string' ? identity.provider : '';
		if (provider === 'fortytwo' || provider === 'custom:fortytwo') return true;
		if (provider.startsWith('custom:')) return true;
		return identity?.identity_data?.email_verified !== true;
	};
	const nonEmailIdentities = identities.filter((identity) => identity?.provider !== 'email');
	const allNonEmailVerified = nonEmailIdentities.every((identity) => !isUnverifiedIdentity(identity));
	const confirmedAt = Date.parse(typeof user.email_confirmed_at === 'string' ? user.email_confirmed_at : '');
	// An unknown provider date is not dropped: it makes the recency rule fail closed.
	const nonEmailDates = nonEmailIdentities.map((identity) => Date.parse(typeof identity?.created_at === 'string' ? identity.created_at : ''));
	const datesKnown = nonEmailDates.every((value) => Number.isFinite(value));
	const earliest = datesKnown && nonEmailDates.length > 0 ? Math.min(...nonEmailDates) : Number.NaN;
	const confirmedBeforeIdentities = datesKnown && Number.isFinite(confirmedAt) && Number.isFinite(earliest) && confirmedAt <= earliest;
	// A provider sign-in only reaches a single-identity account. GoTrue links a provider by email into
	// an existing account, and with autoconfirm on that account may be a /signup row whose holder never
	// proved the mailbox yet looks confirmed before the provider identity (F1). Password sign-in keeps
	// the dated rule, so a user whose account GoTrue linked is not locked out of it.
	const allowed = datesKnown && (identities.length === 1 || (!options.singleIdentityOnly && allNonEmailVerified && Boolean(user.email_confirmed_at) && confirmedBeforeIdentities));
	// AUTH_OAUTH_LINK_EXISTING: the provider sign-in may still reach the account once oauth-link.mjs
	// removed every credential the provider did not prove; off keeps the refusal below untouched.
	const linked = !allowed && options.singleIdentityOnly && oauthLink.mode !== 'off' ? await oauthLink.link({ userId: subject, accessToken, email }) : null;
	if (linked && !linked.allow) {
		json(response, linked.status, linked.body);
		return 'failed';
	}

	if (!allowed && !linked) {
		await audit('osionos_bridge_refused', request, { email, reason: 'oauth_email_collision' });
		const logoutPromise = gotrue.logout(accessToken, 'local').then((result) => {
			if (!result.ok) audit('osionos_bridge_refused_logout_failed', request, { email, reason: 'oauth_email_collision' }).catch(() => undefined);
		}).catch(() => {
			audit('osionos_bridge_refused_logout_failed', request, { email, reason: 'oauth_email_collision' }).catch(() => undefined);
		});
		void logoutPromise;
		json(response, 409, { error: 'oauth_email_collision', message: 'This email is already linked to another sign-in method.' });
		return 'refused_logged_out';
	}

	const metadata = typeof user.user_metadata === 'object' && user.user_metadata !== null ? user.user_metadata : {};
	const payload = {
		provider: 'prismatica',
		subject,
		email,
		name: typeof metadata.username === 'string' ? metadata.username : email.split('@')[0],
		// Signed with the rest so the bridge can trust it; a strict boolean, never the raw timestamp.
		// An exempt address was never proven by its inbox, so false is its true value.
		emailVerified: Boolean(user.email_confirmed_at) && !isVerificationExempt(verificationExempt, email),
		jti: randomUUID(),
	};
	const timestamp = String(Date.now());
	let result;
	try {
		result = await fetch(config.osionosBridgeUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-prismatica-bridge-timestamp': timestamp,
				'x-prismatica-bridge-signature': bridgeSignature(timestamp, payload),
			},
			body: JSON.stringify(payload),
		});
	} catch (error) {
		await audit('osionos_bridge_failed', request, { email, status: 502, error: error instanceof Error ? error.message : 'bridge_unreachable' });
		json(response, 502, { message: 'osionos bridge is unreachable.' });
		return 'failed';
	}
	const body = await result.json().catch(() => ({}));
	if (result.ok && config.osionosAppUrl && typeof body?.redirectUrl === 'string' && !body.redirectUrl.startsWith(config.osionosAppUrl)) {
		await audit('osionos_bridge_redirect_rejected', request, { email, status: result.status });
		json(response, 502, { message: 'osionos bridge returned an unexpected redirect target.' });
		return 'failed';
	}
	await audit(result.ok ? 'osionos_bridge_success' : 'osionos_bridge_failed', request, { email, status: result.status });
	if (!result.ok && result.status >= 500 && options.mapBridgeFailureTo502) {
		json(response, 502, { message: 'osionos bridge is unreachable.' });
		return 'failed';
	}
	const credentialReset = result.ok && linked?.credentialReset === true;
	if (result.ok && options.scheduleAlertOnSuccess) scheduleLoginAlert(request, email, 'success', credentialReset);
	// The refresh cookie is a success credential: a refused or failed mint never sends it.
	// credential_reset tells the callback page to say the password is gone (C351).
	json(response, result.status, { ...sanitizeAuthPayload(body), ...(credentialReset ? { credential_reset: true } : {}) }, result.ok ? options.responseHeaders ?? {} : {});
	return result.ok ? 'minted' : 'failed';
}

async function handleOsionosSession(request, response) {
	await mintOsionosSession(request, response, { accessToken: bearerToken(request) });
}

function oauthOrigin(request) {
	const header = request.headers.origin;
	const value = Array.isArray(header) ? header[0] : header;
	if (!value) return false;
	try {
		return value === new URL(config.siteUrl).origin;
	} catch {
		return false;
	}
}

// A post-exchange refusal must not leave the GoTrue session alive; the 409 path already logged out.
function revokeOauthSession(accessToken, request) {
	const failed = (status) => {
		audit('oauth_session_logout_failed', request, { status }).catch(() => undefined);
	};
	gotrue.logout(accessToken, 'local').then((result) => {
		if (!result.ok) failed(result.status);
	}).catch(() => failed(0));
}

async function oauthProviders() {
	const settings = await gotrue.settings();
	return settings.ok ? enabledOauthProviders(settings.body) : [];
}

// origin lets a site served elsewhere (the beta) hide the buttons: the callback only returns to siteUrl.
async function handleOauthProviders(request, response) {
	json(response, 200, { providers: await oauthProviders(), origin: new URL(config.siteUrl).origin });
}

// A browser navigation, so every refusal lands on the callback page that explains it.
async function handleOauthAuthorize(request, response) {
	const query = new URL(request.url ?? '/', 'http://gateway').searchParams;
	const provider = query.get('provider') ?? '';
	const codeChallenge = query.get('code_challenge') ?? '';
	const refuse = (error) => {
		response.writeHead(302, { location: `${siteBaseUrl()}/auth/callback?error=${error}`, 'cache-control': 'no-store' });
		response.end();
	};
	if (config.loginEmailOtp || !isS256Challenge(codeChallenge)) return refuse('oauth_invalid_request');
	if (await rateLimit(clientIp(request), 'oauthSession')) return refuse('rate_limited');
	if (!(await oauthProviders()).includes(provider)) return refuse('oauth_provider_unavailable');
	response.writeHead(302, { location: oauthAuthorizeUrl({ siteUrl: config.siteUrl, anonKey: config.anonKey, provider, codeChallenge }), 'cache-control': 'no-store' });
	response.end();
}

async function handleOauthSession(request, response) {
	if (!oauthOrigin(request)) {
		json(response, 403, { error: 'oauth_origin_refused', message: 'Sign-in must start from the Prismatica site.' });
		return;
	}
	const contentType = String(request.headers['content-type'] ?? '').trim().toLowerCase();
	if (!contentType.startsWith('application/json')) {
		json(response, 415, { error: 'unsupported_media_type', message: 'Send JSON.' });
		return;
	}
	if (config.loginEmailOtp) {
		json(response, 409, { error: 'oauth_requires_password_login', message: 'OAuth sign-in requires password login.' });
		return;
	}
	const retryAfter = await rateLimit(clientIp(request), 'oauthSession');
	if (retryAfter) {
		json(response, 429, { error: 'rate_limited', message: 'Too many attempts. Please retry later.' }, { 'retry-after': String(retryAfter) });
		return;
	}
	let payload;
	try {
		payload = await readJson(request);
	} catch {
		json(response, 400, { message: 'Invalid request body.' });
		return;
	}
	const code = String(payload?.code ?? '').trim();
	const verifier = String(payload?.verifier ?? '').trim();
	if (!code || !verifier || code.length > 512 || verifier.length > 512) {
		json(response, 400, { message: 'OAuth code and verifier are required.' });
		return;
	}
	// F1 measured the takeover with autoconfirm true; F15 measured /settings exposes it as a boolean.
	if ((await oauthProviders()).length === 0) {
		json(response, 503, { error: 'oauth_unsafe_config', message: 'Provider sign-in is not available right now.' });
		return;
	}
	const exchanged = await gotrue.exchangePkce(code, verifier);
	const accessToken = typeof exchanged.body?.access_token === 'string' ? exchanged.body.access_token : '';
	if (!exchanged.ok || !accessToken) {
		await audit('oauth_exchange_failed', request, { status: exchanged.status });
		if (exchanged.status === 0 || exchanged.status >= 500) {
			json(response, 502, { error: 'oauth_upstream_failed', message: 'The sign-in service did not answer. Try again in a minute.' });
			return;
		}
		// Fixed text: GoTrue's own error body is never reflected.
		json(response, 401, { error: 'oauth_exchange_failed', message: 'OAuth sign-in failed.' });
		return;
	}
	const refreshToken = typeof exchanged.body.refresh_token === 'string' ? exchanged.body.refresh_token : '';
	const responseHeaders = refreshToken ? { 'set-cookie': refreshCookie(refreshToken) } : {};
	const outcome = await mintOsionosSession(request, response, { accessToken, responseHeaders, scheduleAlertOnSuccess: true, mapBridgeFailureTo502: true, singleIdentityOnly: true });
	if (outcome === 'failed') revokeOauthSession(accessToken, request);
}

async function emailOtpAction(request, response, action, flow) {
	const retryAfter = await rateLimit(clientIp(request), action);
	if (retryAfter) {
		json(response, 429, { error: 'rate_limited', message: 'Too many attempts. Please retry later.' }, { 'retry-after': String(retryAfter) });
		return;
	}
	await flow(ticketFrom(request.headers.cookie), await readJson(request));
}

// Only the ticket's email goes to grobase: an `email` in this body is never read.
async function handleMfaEmailVerify(request, response) {
	await emailOtpAction(request, response, 'otpVerify', async (ticket, payload) => {
		respondWithTicketOutcome(request, response, await loginOtp.verify(ticket, payload.code));
	});
}

// A correct code and an approved poll end here, so both answer with the same body and cookies.
function respondWithTicketOutcome(request, response, result) {
	const headers = {};
	if (result.refreshToken) headers['set-cookie'] = [refreshCookie(result.refreshToken), clearTicketCookie()];
	else if (result.clearTicket) headers['set-cookie'] = clearTicketCookie();
	if (result.retryAfterSec) headers['retry-after'] = String(result.retryAfterSec);
	if (result.status === 200) scheduleLoginAlert(request, result.email, 'success');
	json(response, result.status, result.body, headers);
}

async function handleMfaEmailStatus(request, response) {
	await emailOtpAction(request, response, 'otpStatus', async (ticket) => {
		respondWithTicketOutcome(request, response, await loginApprove.status(ticket, clientIp(request)));
	});
}

async function handleMfaEmailResend(request, response) {
	await emailOtpAction(request, response, 'otpResend', async (ticket) => {
		const result = await loginOtp.resend(ticket);
		json(response, result.status, result.body, result.retryAfterSec ? { 'retry-after': String(result.retryAfterSec) } : {});
	});
}

function handleMfaHook(response) {
	json(response, 501, { message: 'MFA hook reserved. Wire this endpoint to TOTP or WebAuthn provider integration before enabling in production.' });
}

const routes = new Map([
	['GET /api/auth/health', handleHealth],
	['POST /api/auth/register', handleRegister],
	['POST /api/auth/login', handleLogin],
	['POST /api/auth/recover', handleRecover],
	['POST /api/auth/resend-verification', handleResendVerification],
	['POST /api/auth/verify', handleVerify],
	['POST /api/auth/reset-password', handleResetPassword],
	['POST /api/auth/refresh', handleRefresh],
	['POST /api/auth/logout', handleLogout],
	['POST /api/auth/osionos-session', handleOsionosSession],
	['GET /api/auth/oauth/providers', handleOauthProviders],
	['GET /api/auth/oauth/authorize', handleOauthAuthorize],
	['POST /api/auth/oauth-session', handleOauthSession],
	...(config.loginEmailOtp ? [['POST /api/auth/mfa/email/verify', handleMfaEmailVerify], ['POST /api/auth/mfa/email/resend', handleMfaEmailResend]] : []),
	...(loginApprove ? [['POST /api/auth/mfa/email/status', handleMfaEmailStatus], ...approveRoutes({ loginApprove, rateLimit, clientIp, readJson, json })] : []),
	['POST /api/newsletter/subscribe', handleNewsletterSubscribe],
	['POST /api/newsletter/confirm', handleNewsletterConfirm],
	['POST /api/newsletter/unsubscribe', handleNewsletterUnsubscribe],
]);

enforceStartupGuards(config, { logger: console });
if (config.linkSigningKeyProblem) {
	console.error(`[auth-gateway] ${config.linkSigningKeyProblem} Verification and reset e-mails are off: /api/auth/verify and /reset-password answer 503, /recover and /resend-verification send nothing.`);
}

createServer(async (request, response) => {
	try {
		if (request.method === 'OPTIONS') {
			response.writeHead(204, { 'access-control-allow-origin': config.siteUrl, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization' });
			response.end();
			return;
		}
		const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
		const route = routes.get(`${request.method} ${url.pathname}`);
		if (route) {
			await route(request, response);
			return;
		}
		if (request.method === 'POST' && url.pathname.startsWith('/api/auth/mfa/')) {
			handleMfaHook(response);
			return;
		}
		json(response, 404, { message: 'Not found.' });
	} catch (error) {
		const status = Number(error?.status ?? 500);
		json(response, status, { message: status >= 500 ? 'Authentication gateway error.' : String(error?.message ?? 'Request error.') });
	}
}).listen(config.port, () => {
	console.log(`Auth gateway listening on http://localhost:${config.port}/api/auth and /api/newsletter (rate-limit store: ${store.backendName()}, trusted proxy hops: ${config.trustedProxyHops})`);
});
