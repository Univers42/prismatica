// @vitest-environment node
// The real gateway's mail queue (groot ADR 0048): one worker keeps registerJob's check-then-act
// in order, and a queued mail Kong refuses waits out a window the 10 s live retry would miss.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, hitsTo, hits, loginBody, startFakeKong, startGateway, stopAll, upstream, type Gateway } from './gateway-harness';

const PASSWORD = 'Sign-Up-Pass-1!';
const registration = (email: string, username: string) => ({ email, password: PASSWORD, turnstileToken: 'localhost-turnstile-token', profile: { username, confirmPassword: PASSWORD } });
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const mailTo = (address: string) => hitsTo('/email/v1/send').filter((hit) => JSON.parse(hit.body).to === address);

let verifying: Gateway;
let confirmedAtOnce: Gateway;
let signingIn: Gateway;

beforeAll(async () => {
	await startFakeKong();
	verifying = await startGateway({});
	confirmedAtOnce = await startGateway({ AUTH_REQUIRE_EMAIL_VERIFICATION: 'false' });
	signingIn = await startGateway({});
}, 30_000);

afterAll(stopAll);

beforeEach(() => {
	hits.length = 0;
	upstream.existingEmails = [];
	upstream.generateLinkDelayMs = 0;
	upstream.profilesPersist = false;
	upstream.mailRefusalRetryAfterSec = 0;
});

describe('two /register for one address, back to back', () => {
	it('confirms once and tells the second caller the address is taken', async () => {
		upstream.generateLinkDelayMs = 150;
		upstream.profilesPersist = true;
		const email = 'race@arlet.test';
		expect((await call(verifying, '/api/auth/register', { body: registration(email, 'race_first') })).status).toBe(202);
		expect((await call(verifying, '/api/auth/register', { body: registration(email, 'race_second') })).status).toBe(202);
		await sleep(1_000);
		expect(mailTo(email).map((hit) => JSON.parse(hit.body).subject)).toEqual(['Confirm your email', 'You already have an account']);
		expect(hitsTo('/auth/v1/admin/generate_link')).toHaveLength(1);
	});
});

describe('a queued mail Kong refuses for longer than the live retry waits', () => {
	it('arrives after the window: account mail, the account-created notice, the sign-in alert', async () => {
		const retryAfterSec = 11;
		upstream.mailRefusalRetryAfterSec = retryAfterSec;
		const addresses = ['wait-confirm@arlet.test', 'wait-created@arlet.test', 'wait-alert@arlet.test'];
		upstream.existingEmails = ['wait-alert@arlet.test'];
		await Promise.all([
			call(verifying, '/api/auth/register', { body: registration(addresses[0]!, 'wait_confirm') }),
			call(confirmedAtOnce, '/api/auth/register', { body: registration(addresses[1]!, 'wait_created') }),
			call(signingIn, '/api/auth/login', { body: loginBody(addresses[2]) }),
		]);
		await sleep((retryAfterSec + 1) * 1_000);
		for (const address of addresses) {
			const [refused, accepted] = mailTo(address);
			expect(accepted, `${address} was retried`).toBeDefined();
			expect(accepted!.at - refused!.at, `${address} waited out the window`).toBeGreaterThanOrEqual(retryAfterSec * 1_000);
		}
	}, 20_000);
});
