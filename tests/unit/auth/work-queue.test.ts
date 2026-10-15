// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createWorkQueue } from '../../../scripts/auth/work-queue.mjs';

const never = () => new Promise<void>(() => {});

describe('createWorkQueue', () => {
	it('never holds more than maxLength waiting jobs, whatever is pushed (10 000 pushes)', () => {
		const onDrop = vi.fn();
		const queue = createWorkQueue({ maxLength: 50, concurrency: 2, onDrop });
		let accepted = 0;
		for (let index = 0; index < 10_000; index += 1) {
			if (queue.push('recover', never)) accepted += 1;
			expect(queue.size()).toBeLessThanOrEqual(50);
		}
		expect(queue.running()).toBe(2);
		expect(queue.peak()).toBe(50);
		expect(accepted).toBe(52);
		expect(onDrop).toHaveBeenCalledTimes(10_000 - 52);
		expect(onDrop).toHaveBeenLastCalledWith('recover');
	});

	it('runs at most `concurrency` jobs at once', async () => {
		const queue = createWorkQueue({ maxLength: 100, concurrency: 2 });
		let live = 0;
		let most = 0;
		const job = async () => {
			live += 1;
			most = Math.max(most, live);
			await new Promise((resolve) => setTimeout(resolve, 2));
			live -= 1;
		};
		for (let index = 0; index < 20; index += 1) queue.push('job', job);
		await queue.idle();
		expect(most).toBe(2);
		expect(queue.size()).toBe(0);
	});

	it('catches a rejected job and a throwing one, reports both, and keeps serving', async () => {
		const unhandled = vi.fn();
		process.on('unhandledRejection', unhandled);
		const onError = vi.fn();
		const queue = createWorkQueue({ maxLength: 10, concurrency: 2, onError });
		const done = vi.fn();
		queue.push('rejects', async () => {
			throw new Error('GoTrue is down');
		});
		queue.push('throws', () => {
			throw new Error('sync throw');
		});
		queue.push('works', async () => done());
		await queue.idle();
		await new Promise((resolve) => setTimeout(resolve, 5));
		process.off('unhandledRejection', unhandled);
		expect(onError).toHaveBeenCalledTimes(2);
		expect(onError.mock.calls.map((call) => call[1]).sort()).toEqual(['rejects', 'throws']);
		expect(done).toHaveBeenCalledTimes(1);
		expect(unhandled).not.toHaveBeenCalled();
	});

	it('survives an onError or onDrop hook that throws', async () => {
		const queue = createWorkQueue({
			maxLength: 0,
			concurrency: 1,
			onError: () => {
				throw new Error('audit failed');
			},
			onDrop: () => {
				throw new Error('audit failed');
			},
		});
		expect(queue.push('a', async () => {
			throw new Error('x');
		})).toBe(true);
		expect(queue.push('b', async () => undefined)).toBe(false);
		await queue.idle();
		expect(queue.running()).toBe(0);
	});
});
