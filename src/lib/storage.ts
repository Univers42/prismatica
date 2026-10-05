/** Safely reads a persisted value. */
export function readStorage(key: string): string | null {
	try {
		return globalThis.localStorage.getItem(key);
	} catch {
		return null;
	}
}

/** Safely writes a persisted value. */
export function writeStorage(key: string, value: string): void {
	try {
		globalThis.localStorage.setItem(key, value);
	} catch {
		return;
	}
}
