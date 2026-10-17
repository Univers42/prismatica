// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createMailDailyCap, resolveMailDailyCap } from '../../../scripts/auth/mail-daily-cap.mjs';
import { memoryStore } from './fakes';

describe('resolveMailDailyCap', () => {
	it('is uncapped off a production origin when unset or 0', () => {
		expect(resolveMailDailyCap(undefined, false)).toBe(0);
		expect(resolveMailDailyCap('0', false)).toBe(0);
	});

	it('defaults to 200 on a production origin, with no way to turn it off', () => {
		for (const raw of [undefined, '', '0', '-5', 'many']) expect(resolveMailDailyCap(raw, true)).toBe(200);
	});

	it('takes an explicit positive integer anywhere', () => {
		expect(resolveMailDailyCap('50', true)).toBe(50);
		expect(resolveMailDailyCap('7', false)).toBe(7);
	});
});

describe('createMailDailyCap', () => {
	it('grants exactly `cap` slots in a UTC day, refuses the next, and warns once without an address', async () => {
		const logger = { warn: vi.fn() };
		const gate = createMailDailyCap({ store: memoryStore(), cap: 3, now: () => new Date('2026-10-17T23:59:00Z'), logger });
		expect([await gate.take(), await gate.take(), await gate.take()]).toEqual([true, true, true]);
		expect([await gate.take(), await gate.take()]).toEqual([false, false]);
		expect(logger.warn).toHaveBeenCalledTimes(1);
		expect(String(logger.warn.mock.calls[0][0])).toContain('2026-10-17');
		expect(String(logger.warn.mock.calls[0][0])).not.toContain('@');
	});

	it('starts a fresh count when the UTC day rolls over', async () => {
		let now = new Date('2026-10-17T23:59:59Z');
		const gate = createMailDailyCap({ store: memoryStore(), cap: 1, now: () => now, logger: { warn: vi.fn() } });
		expect(await gate.take()).toBe(true);
		expect(await gate.take()).toBe(false);
		now = new Date('2026-10-18T00:00:01Z');
		expect(await gate.take()).toBe(true);
	});

	it('never refuses with a cap of 0', async () => {
		const gate = createMailDailyCap({ store: memoryStore(), cap: 0 });
		for (let index = 0; index < 5; index += 1) expect(await gate.take()).toBe(true);
	});
});
