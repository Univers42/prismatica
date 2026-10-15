#!/usr/bin/env node
/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   verify-smtp.mjs                                    :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Manual check of the real SMTP account: sends one plain message to SMTP_TEST_TO through the
// gateway's own mailer, configured by grobase's names (SMTP_HOST, SMTP_PORT, SMTP_USER,
// SMTP_PASS, EMAIL_FROM, SMTP_SECURE). Nothing has a default host: an unset SMTP_HOST fails
// here instead of silently reaching a real provider.
import assert from 'node:assert/strict';
import { smtpConfigFromEnv } from './auth/smtp-config.mjs';
import { createSmtpMailer } from './auth/smtp-mailer.mjs';

const smtp = smtpConfigFromEnv(process.env);
const toAddress = process.env.SMTP_TEST_TO ?? 'dev.pro.photo@gmail.com';

try {
	assert.ok(smtp.host, 'SMTP_HOST is required.');
	assert.ok(smtp.user && smtp.pass, 'SMTP_USER and SMTP_PASS are required.');
	assert.ok(smtp.fromAddress, 'EMAIL_FROM is required.');
	console.log(`Connecting to ${smtp.host}:${smtp.port} (${smtp.secure}) as ${smtp.user}; password=[REDACTED]`);
	await createSmtpMailer(smtp).send({
		to: toAddress,
		subject: 'Prismatica SMTP test',
		html: `<p>Prismatica SMTP test sent at ${new Date().toISOString()}.</p>`,
		text: `Prismatica SMTP test sent at ${new Date().toISOString()}.`,
	});
	console.log(`SMTP send accepted by ${smtp.host} for ${toAddress}.`);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
