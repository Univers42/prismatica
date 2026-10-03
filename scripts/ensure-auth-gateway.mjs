#!/usr/bin/env node
/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   ensure-auth-gateway.mjs                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const authGatewayScript = resolve(projectDir, 'scripts/auth-gateway.mjs');

/** @type {import('node:child_process').ChildProcess | undefined} */
export let authGatewayChild;

function canConnect(address, targetPort) {
	return new Promise((resolveConnection) => {
		const socket = connect({ host: address, port: targetPort, timeout: 350 });
		socket.once('connect', () => {
			socket.destroy();
			resolveConnection(true);
		});
		socket.once('timeout', () => {
			socket.destroy();
			resolveConnection(false);
		});
		socket.once('error', () => resolveConnection(false));
	});
}

export async function isListening(targetPort) {
	const addresses = ['127.0.0.1', '::1'];
	const results = await Promise.all(addresses.map((address) => canConnect(address, targetPort)));
	return results.some(Boolean);
}

/**
 * Starts the auth gateway when the site uses same-origin `/api/auth` proxy routes.
 * @param {{ authGatewayPort: number, siteUrl: string, onFatal?: (message: string) => never }} options
 */
export async function ensureAuthGateway(options) {
	const { authGatewayPort, siteUrl, onFatal = (message) => { throw new Error(message); } } = options;
	if (!String(process.env.PUBLIC_AUTH_GATEWAY_URL ?? '/api/auth').startsWith('/api/auth')) {
		return;
	}
	if (await isListening(authGatewayPort)) {
		console.log(`Auth gateway already listening at http://localhost:${authGatewayPort}/`);
		return;
	}
	if (!existsSync(authGatewayScript)) {
		onFatal(`Auth gateway proxy is configured but the script is missing: ${authGatewayScript}`);
	}
	console.log(`Starting auth gateway at http://localhost:${authGatewayPort}/ for /api/auth proxy routes.`);
	authGatewayChild = spawn(process.execPath, [authGatewayScript], {
		cwd: projectDir,
		env: {
			...process.env,
			AUTH_GATEWAY_PORT: String(authGatewayPort),
			PUBLIC_SITE_URL: siteUrl,
		},
		stdio: 'inherit',
	});
	await new Promise((resolveReady) => setTimeout(resolveReady, 600));
	if (!(await isListening(authGatewayPort))) {
		onFatal(`Auth gateway did not start on port ${authGatewayPort}.`);
	}
}

export function stopAuthGateway() {
	authGatewayChild?.kill('SIGTERM');
	authGatewayChild = undefined;
}
