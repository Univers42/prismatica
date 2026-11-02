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

// FILE_TOO_LARGE_FOR_SINGLE_TOOL_CALL - partial upload will break the gateway
