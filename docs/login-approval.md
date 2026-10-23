# Sign-in approval ("Yes, it's me")

Gateway flags: `AUTH_LOGIN_EMAIL_OTP=true` and `AUTH_LOGIN_APPROVE_LINK=true` (default false; the second does nothing without the first).
After a correct password the gateway parks the session behind the login ticket and mails one "Sign-in request" message.
The waiting browser shows a 2-digit number; the user opens the mail on another device, types that number on `/auth/approve`, and the waiting browser's next poll of `POST /api/auth/mfa/email/status` receives the session. "Email me a code instead" falls back to the emailed code on the same ticket. Implementation: `scripts/auth/login-approve.mjs`; routes: `scripts/auth/approve-routes.mjs`.

## Residual risk

A real-time phishing proxy defeats number matching and emailed codes alike: it relays the victim's screen, so the victim reads the real number to the attacker's page and types it where the approval link points, or hands over the code. Only a phishing-resistant factor bound to the origin (WebAuthn) stops that. Number matching narrows the window for a victim who approves a request they did not start; it does not close the proxy case. A wrong number revokes the ticket at once, and each approval link allows one attempt, so a 1-in-90 guess costs the attacker the session.
