# 0002. Provider sign-in to an account that already has a password

- Status: accepted with conditions (C341–C355, C370–C381). Ships as `off`; `on` waits on C381.
- Date: 2026-10-27
- Deciders: devil (verdict "oauth-link + newsletter", `osionos-ai-records/oauth-link-newsletter-verdict.md`)

## Context

- A Google or GitHub sign-in with an address that already has a password account answers 409
  `oauth_email_collision`. The owner of that address cannot get in with the provider.
- GoTrue links the provider identity into the existing account by email. Autoconfirm is on, so that
  account may be a `/signup` row someone created before the owner arrived (F1). That person knows
  its password. Letting the provider identity in as-is hands the owner an account the pre-hijacker
  still controls.
- Probed on GoTrue v2.188.1 (C349, `oauth-link-c349-gotrue-probe.md`):
  - an admin PUT merges `app_metadata`, and a user PUT of it answers 403;
  - `logout?scope=others` revokes refresh tokens;
  - factors come back as an array;
  - a pending email change survives as `new_email`.

## Decision

`AUTH_OAUTH_LINK_EXISTING` = `off` (default) | `observe` | `on`. Any other value stops the boot.
The code is in `scripts/auth/oauth-link.mjs` and is called from `mintOsionosSession` only for
`oauth-session`.

- `off`: the 409 stays as it was. No admin read.
- `observe`: reads the account (admin user, factors, a read-only probe of both token tables). It
  audits `oauth_link_refused{reason:'observe', would_reset, would_refuse_reason}` and still
  answers 409. No write and no lock (C380).
- `on`:
  - **Refused (409):** a pending email change, a phone number, an anonymous or banned account, or
    any provider identity whose verified email does not match.
  - **Refused (409 `oauth_mfa_account`):** an account with a verified factor.
  - **Unreadable account (503):** refused.
  - **No password, or a `mailbox_proof` marker** (written by a completed password reset): opens
    with no change.
  - **Otherwise, under a Redis lock per user** (SET NX EX 60; no memory fallback when Redis is
    configured), in order:
    1. set an unknown password;
    2. drop the unverified factors;
    3. `logout?scope=others`;
    4. re-read the account;
    5. write the osionos session cut-off;
    6. revoke AI and personal access tokens;
    7. mail the owner;
    8. write the marker **last**.

    Any failure answers 503 `oauth_link_reset_failed` and writes no marker, so the next sign-in
    resets again. On success the response carries `credential_reset: true`; the callback page says
    the password is gone, and the login alert skips its daily dedupe (C373).

## Consequences

- R1 (accepted by the owner before `on`): whatever the pre-hijacker did inside osionos survives the
  reset. That covers shared workspaces, invited members and written pages. The notice mail names the
  revoked tokens and how many members sit in workspaces the user owns; it does not remove them.
- An account wedged by an attacker's verified factor answers `oauth_mfa_account` forever. The
  operator recovers it with GoTrue admin `DELETE /admin/users/<id>/factors/<factor>` once the owner
  has proven the mailbox by a password reset (C355).
- Personal access tokens are revoked with `revoked_reason = 'admin'`: the table's CHECK allows only
  `user` and `admin` (deviation from C379, noted in the verdict file).
- Turning it `on` (C381): the owner's R1 acceptance line and 24 h of observe counts must be in the
  verdict file, and a human flips the flag. Then run the throwaway-user rehearsal (C376).
