#!/usr/bin/env node
/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   run-all.mjs                                        :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// Pure unit tests for the auth-gateway hardening modules (net-ip, guards,
// store). These need NO network and NO running stack — they must pass on a
// bare checkout in the node container. Aggregated here and also exported as a
// single `run()` so run-all.mjs can register a "gateway-unit" category.

import { summarize } from '../_shared.mjs';
import * as netIp from './net-ip.mjs';
import * as guards from './guards.mjs';
import * as store from './store.mjs';

const colors = {
	green: '\u001b[32m',
	red: '\u001b[31m',
	yellow: '\u001b[33m',
	cyan: '\u001b[36m',
	bold: '\u001b[1m',
	reset: '\u001b[0m',
};

const modules = [
	{ key: 'net-ip', name: 'Trusted client-IP derivation', module: netIp },
	{ key: 'guards', name: 'Fail-closed startup guards', module: guards },
	{ key: 'store', name: 'Bounded TTL store + RESP parser', module: store },
];

// Aggregate every unit module into one result so the parent suite can show a
// single "gateway-unit" category.
export async function run() {
	const all = [];
	for (const entry of modules) {
		const result = await entry.module.run();
		all.push(...result.results);
	}
	return summarize(all);
}

function marker(status) {
	if (status === 'passed') return `${colors.green}PASS${colors.reset}`;
	if (status === 'skipped') return `${colors.yellow}SKIP${colors.reset}`;
	return `${colors.red}FAIL${colors.reset}`;
}

// Standalone CLI: only runs when invoked directly (not when imported).
if (import.meta.url === `file://${process.argv[1]}`) {
	let totalPassed = 0;
	let totalFailed = 0;
	let totalSkipped = 0;

	console.log(`${colors.bold}${colors.cyan}Running auth-gateway hardening UNIT tests (no stack required)${colors.reset}`);

	for (const entry of modules) {
		const result = await entry.module.run();
		totalPassed += result.passed;
		totalFailed += result.failed;
		totalSkipped += result.skipped;

		const statusColor = result.failed > 0 ? colors.red : colors.green;
		console.log(`\n${colors.bold}${entry.name}${colors.reset}`);
		console.log(`${statusColor}passed=${result.passed} failed=${result.failed}${colors.reset} ${colors.yellow}skipped=${result.skipped}${colors.reset}`);
		for (const item of result.results) {
			console.log(`  ${marker(item.status)} ${item.name} — ${item.message}`);
			if (item.status === 'failed') console.log(`       ${item.description}`);
		}
	}

	const summaryColor = totalFailed > 0 ? colors.red : colors.green;
	console.log(`\n${summaryColor}${colors.bold}GATEWAY UNIT TESTS: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped${colors.reset}`);
	if (totalFailed > 0) process.exitCode = 1;
}
