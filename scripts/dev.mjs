#!/usr/bin/env node
/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   dev.mjs                                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureAuthGateway, stopAuthGateway } from './ensure-auth-gateway.mjs';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const astroBin = resolve(projectDir, 'node_modules/.bin/astro');
const host = process.env.ASTRO_DEV_HOST ?? '0.0.0.0';
const port = Number(process.env.ASTRO_DEV_PORT ?? 4322);
const authGatewayPort = Number(process.env.AUTH_GATEWAY_PORT ?? 8787);

function fail(message) {
	console.error(`\n${message}\n`);
	process.exit(1);
}

await ensureAuthGateway({
	authGatewayPort,
	siteUrl: process.env.PUBLIC_SITE_URL ?? `http://localhost:${port}`,
	onFatal: fail,
});

console.log(`Starting Astro at http://localhost:${port}/`);
const child = spawn(astroBin, ['dev', '--host', host, '--port', String(port)], {
	cwd: projectDir,
	env: process.env,
	stdio: 'inherit',
});

child.on('exit', (code, signal) => {
	stopAuthGateway();
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}
	process.exit(code ?? 0);
});
