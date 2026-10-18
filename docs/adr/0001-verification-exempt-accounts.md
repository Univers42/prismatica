# 0001. Verification-exempt accounts

- Status: accepted with conditions (E1-E5). E3 rejected, E4 replaced.
- Date: 2026-10-18
- Deciders: devil (verdict "AUTH_VERIFICATION_EXEMPT and the three-sign-in test plan", 2026-10-18)

## Context

- A test or demo account can sit on an address the operator does not own (dylan@gmail.com is a
  stranger's inbox). Every login alert, verification and reset mail the gateway sends goes to that
  stranger.
- Every gateway mail goes through one function, `sendMail` in `scripts/auth-gateway.mjs`: login
  alerts, account-created, `account-mail.mjs` (verification, reset, account-exists) and
  `login-approve.mjs`.
- The emailed sign-in code is not one of them. It is sent by grobase's code service
  (`otp-client.mjs`), so `sendMail` cannot catch it.
- Unmeasured (U1): whether baas GoTrue has SMTP configured.

## Decision

`AUTH_VERIFICATION_EXEMPT` lists exact addresses, parsed once at boot in
`scripts/auth/verification-exempt.mjs`.

- E1: `sendMail` does not call the mailer for a listed recipient. It writes one
  `mail_suppressed_exempt` audit (the address, no body) and returns as if sent.
- E2: register with a listed address answers the 202 a taken address gets, before
  `requestRegistration`, with no link requested and no mail. Audit `signup_refused_exempt`.
- E5: the payload signed for the osionos bridge carries `emailVerified: false` for a listed address,
  confirmed or not. The bridge then refuses admin promotion (R1b); it never receives the list.
- Boot guard, on every origin: refuses an entry that is not an address, starts with `@`, contains
  `*` or has a quoted local part; more than 10 entries; and a non-empty list with
  `AUTH_LOGIN_EMAIL_OTP=true`.

Rejected: E3 (the gateway confirming a listed account at login), see
`.out-of-scope/exempt-login-auto-confirm.md`. Replaced: E4 (skip the emailed code for listed
accounts) became the boot refusal above, because skipping the code is a second-factor bypass list.

## Consequences

- An exempt account belongs to whoever reads its inbox. baas `/auth/v1/recover` and `/otp` are
  public with the published anon key, and GoTrue mails through its own SMTP, which E1 cannot
  suppress. So an exempt account is never admin and holds nothing private.
- The better fix for a mistyped or foreign address is one admin call moving the account to an
  address the operator owns. Then the entry is removed from the list.
- Matching is exact on the lowercased address: a plus-tag or dotted variant of a listed Gmail
  address is a different, non-exempt address.
- The audit events `login_alert_sent`, `account_created_email_sent` are not written for a
  suppressed mail. `email_verification_sent`, `password_recovery_email_sent` and
  `account_exists_email_sent` still are, next to `mail_suppressed_exempt`, because
  `account-mail.mjs` audits after its send returns; read the pair together.
- Not covered here: R1b's refusal itself lives in the osionos bridge (`bridge-api.mjs`), tested
  there. This repo tests only that the signed value is false.
