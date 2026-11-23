import { describe, it, expect, afterEach } from 'vitest';
import { readStorage, removeStorage, writeStorage } from '../../../src/lib/storage';

describe('Storage Utils', () => {
	afterEach(() => {
		globalThis.localStorage.clear();
	});

	it('should write and read from storage', () => {
		writeStorage('test-key', 'test-value');
		expect(readStorage('test-key')).toBe('test-value');
	});

	it('should return null for non-existent key', () => {
		expect(readStorage('missing')).toBeNull();
	});

	it('removes a stored key and ignores a missing one', () => {
		writeStorage('test-key', 'test-value');
		removeStorage('test-key');
		removeStorage('missing');
		expect(readStorage('test-key')).toBeNull();
	});
});
