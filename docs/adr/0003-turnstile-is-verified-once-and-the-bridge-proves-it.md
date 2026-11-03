# 0003. Turnstile is verified once, and the osionos bridge proves it did

- Status: accepted with conditions (devil, 2026-11-03: PROCEED-WITH-CONDITIONS). Steps 1–4 ship;
  the cutover waits on condition 5.
- Date: 2026-11-03
- Deciders: devil (verdict on #50), owner (production runs through the home data center on the tailnet)

## Context

- #50: production has no CAPTCHA. prismatica-eta is built with no `PUBLIC_TURNSTILE_SITE_KEY`, so
  the portal sends the fixed `localhost-turnstile-token`. The gateway runs with
  `AUTH_TURNSTILE_OPTIONAL=true` and no `TURNSTILE_SECRET_KEY`, so `verifyTurnstile` accepts any
  non-empty token.
- The flag exists because the osionos bridge proxies the app's own sign-in to this gateway
  (osionos `scripts/bridge-api.mjs` `handleAuthProxy`). In `enforce` mode the bridge siteverifies
  the token itself (`scripts/bridge-turnstile.mjs`). A Cloudflare token is single-use, so a second
  siteverify by the gateway answers `timeout-or-duplicate`, and every app sign-in would be a 403.
- No Turnstile keys exist in the project vault. The owner has to create the widget.
- The osionos app's login form sends no `turnstileToken` (osionos
  `src/features/auth/model/userStore.helpers.ts`).

## Decision

When the bridge has verified a sign-in, it says so with `x-osionos-bridge-proof:
<unix-seconds>.<hex HMAC-SHA256(OSIONOS_BRIDGE_SHARED_SECRET, "<ts>.turnstile.<path>.<stable body>")>`
(`scripts/auth/bridge-proof.mjs`).

- A request that carries the header is judged by the proof alone: valid signature, within ±60 s,
  never seen before (`setIfAbsent`, 120 s TTL). A bad proof never falls back to the token.
- A request without the header goes through `verifyTurnstile` as before.
- The body is signed whole, the spent token included. Each attempt has its own token, so two
  identical sign-ins in one second get two proofs.
- `AUTH_TURNSTILE_OPTIONAL` keeps working until the owner removes it. With a secret set, it is
  never read.

## Alternatives considered

- **The gateway siteverifies the token the bridge forwards:** the token was spent by the bridge,
  so every app sign-in is refused.
- **The bridge sends no token and the gateway trusts the bridge's IP:** the gateway sits behind
  the same proxy as the public, so the IP proves nothing.
- **A proof over the email only:** a captured proof would allow any password for that email for
  60 s. Signing the whole body binds the password.
- **A self-hosted proof-of-work instead of Turnstile:** no third party, but it costs a bot
  seconds, not a solved challenge. It stays an option if Cloudflare is ruled out.

## Consequences

1. The bridge sends the proof only in `enforce` mode, with the bypass off, after its own
   siteverify succeeded in that request. In `off` mode, sending it would vouch for a check that
   never ran (unlimited CAPTCHA-free sign-in). Not shipped yet: osionos side.
2. The proof covers the path and the whole body, so a login proof fails on `/register`.
3. Single-use across replicas holds only with Redis; the memory store is per process.
4. Tested in `tests/unit/auth/bridge-proof.test.ts` and `gateway-bridge-proof.test.ts`: forged,
   expired, future, replayed, cross-path, tampered-body and secret-less proofs are refused, and a
   bad proof does not fall back.
5. **Cutover gate:** the osionos login form renders the widget and sends `turnstileToken`, and the
   widget's hostnames include the app's real browser origin.
6. **Cutover order**, on the home host and Vercel:
   1. Deploy the new gateway and bridge.
   2. Set `TURNSTILE_SECRET_KEY` on both, and the bridge to `enforce`.
   3. Set `PUBLIC_TURNSTILE_SITE_KEY` in `vercel.json` (a site key is public).
   4. Remove `AUTH_TURNSTILE_OPTIONAL`, and in the same change make "OPTIONAL with no secret on a
      public https origin" a startup guard violation.
7. Residual risk: GoTrue's password grant on Kong is public and checks no CAPTCHA. The gateway's
   Turnstile is defence in depth, not a perimeter.
