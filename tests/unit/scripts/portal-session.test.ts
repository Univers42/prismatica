import { afterEach, describe, expect, it } from 'vitest';
import {
	clearAccessToken,
	getAccessToken,
	setAccessToken,
} from '../../../src/scripts/portal-session';

describe('portal-session module', () => {
	afterEach(() => {
		clearAccessToken();
	});

	it('manages access token lifecycle in memory', () => {
		expect(getAccessToken()).toBeNull();

		setAccessToken('test-jwt-token-abc');
		expect(getAccessToken()).toBe('test-jwt-token-abc');

		clearAccessToken();
		expect(getAccessToken()).toBeNull();
	});
});