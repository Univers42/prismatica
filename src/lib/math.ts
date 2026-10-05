export function secureRandom(): number {
	const values = new Uint32Array(1);
	globalThis.crypto.getRandomValues(values);
	return values[0] / 0x100000000;
}

export function randomBetween(minimum: number, span: number): number {
	return minimum + secureRandom() * span;
}

export function randomIndex(length: number): number {
	return Math.floor(secureRandom() * length);
}

/** Restricts a number to the expected animation range. */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
