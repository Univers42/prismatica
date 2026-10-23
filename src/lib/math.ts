/** Restricts a number to the expected animation range. */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
