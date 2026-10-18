# Auto-confirming an exempt account at login is out of scope

- Decided: 2026-10-18 · by devil (verdict E3, AUTH_VERIFICATION_EXEMPT)
- Holds while: no decision unconfirms existing accounts

## The concept

When a listed (`AUTH_VERIFICATION_EXEMPT`) address signs in and its account is unconfirmed, the gateway confirms
it with the service key, so a test account never needs a mail.

## Why not

- It has no caller today: dylan@gmail.com was autoconfirmed 19 ms after it was created, and nothing unconfirms it.
- Register refuses a listed address (E2), so a new exempt account can only come from an admin create, and that call
  sets `email_confirm` itself.
- The one thing it could still do is confirm an unconfirmed account at a listed address that someone else registered
  before E2 shipped. That is the service key confirming accounts on an unauthenticated request.

## Reopen when

A decision unconfirms existing accounts (Q3, the autoconfirm-era accounts) and a listed account needs to stay usable.
