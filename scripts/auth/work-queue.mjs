/**
 * The one queue for work the gateway does after it has answered (verdict B, C6): the account
 * lookup, GoTrue's generate_link and the SMTP send behind /recover, /resend-verification,
 * /register and the sign-in alerts. Answering first removes the timing oracle; this queue
 * keeps that work from crashing or flooding the process:
 *   - at most `maxLength` jobs wait; a push past that is dropped and reported to `onDrop`;
 *   - at most `concurrency` jobs run at once (2: two SMTP sessions, two GoTrue calls);
 *   - every rejection or synchronous throw is caught and reported to `onError`, so a GoTrue
 *     or SMTP failure after the 202 can never become an unhandled rejection (Node >= 15 exits).
 *
 * Caveat: the queue lives in this process. Work still queued when the gateway stops or
 * restarts is lost and never retried; the user asks again (/recover, /resend-verification).
 */

function quietly(hook, ...args) {
	try {
		hook(...args);
	} catch {
		// A failing report must not take the queue down with it.
	}
}

export function createWorkQueue({ maxLength = 500, concurrency = 2, onDrop = () => {}, onError = () => {} } = {}) {
	const waiting = [];
	let running = 0;
	let peak = 0;
	let idleWaiters = [];

	function settleIdle() {
		if (running > 0 || waiting.length > 0) return;
		const waiters = idleWaiters;
		idleWaiters = [];
		for (const resolveIdle of waiters) resolveIdle();
	}

	function start(label, task) {
		running += 1;
		Promise.resolve()
			.then(task)
			.catch((error) => quietly(onError, error, label))
			.finally(() => {
				running -= 1;
				const next = waiting.shift();
				if (next) start(next.label, next.task);
				settleIdle();
			});
	}

	return {
		/** Queue `task` (an async function). False when it was dropped because the queue is full. */
		push(label, task) {
			if (running < concurrency) {
				start(label, task);
				return true;
			}
			if (waiting.length >= maxLength) {
				quietly(onDrop, label);
				return false;
			}
			waiting.push({ label, task });
			peak = Math.max(peak, waiting.length);
			return true;
		},
		size: () => waiting.length,
		running: () => running,
		peak: () => peak,
		/** Resolves once nothing runs and nothing waits. */
		idle() {
			return new Promise((resolveIdle) => {
				idleWaiters.push(resolveIdle);
				settleIdle();
			});
		},
	};
}
