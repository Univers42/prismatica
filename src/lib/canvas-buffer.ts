export type OffscreenBuffer = {
	canvas: HTMLCanvasElement | OffscreenCanvas;
	ctx: CanvasRenderingContext2D;
};

export function createBuffer(w: number, h: number): OffscreenBuffer | null {
	const width = Math.max(1, Math.round(w));
	const height = Math.max(1, Math.round(h));
	if (typeof OffscreenCanvas !== 'undefined') {
		const canvas = new OffscreenCanvas(width, height);
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
		if (ctx) return { canvas, ctx };
	}
	if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (ctx) return { canvas, ctx };
	}
	return null;
}