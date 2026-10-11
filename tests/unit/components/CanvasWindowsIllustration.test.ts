import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const svgPath = path.resolve('/workspace/src/components/svg/CanvasWindowsIllustration.astro');
const svgMarkup = fs.readFileSync(svgPath, 'utf-8');

describe('CanvasWindowsIllustration SVG', () => {
	it('contains title element with id', () => {
		expect(svgMarkup).toContain('<title id="canvas-windows-title">');
	});

	it('contains description element with id', () => {
		expect(svgMarkup).toContain('<desc id="canvas-windows-desc">');
	});

	it('contains canvas-wobble filter', () => {
		expect(svgMarkup).toContain('filter="url(#canvas-wobble)"');
	});

	it('contains canvas-wobble-tight filter', () => {
		expect(svgMarkup).toContain('filter="url(#canvas-wobble-tight)"');
	});

	it('contains canvas-dots pattern ID', () => {
		expect(svgMarkup).toContain('id="canvas-dots"');
	});

	it('has accessible role attribute', () => {
		expect(svgMarkup).toContain('role="img"');
	});

	it('has aria-labelledby attribute', () => {
		expect(svgMarkup).toContain('aria-labelledby');
	});

	it('has correct viewBox', () => {
		expect(svgMarkup).toContain('viewBox="0 0 1100 640"');
	});
});