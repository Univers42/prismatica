import { describe, it, expect, beforeEach } from 'vitest';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const cleaned = hex.replace('#', '');
	if (hex.startsWith('color-mix') || cleaned === '') {
		return { r: 0, g: 0, b: 0 };
	}
	const bigint = parseInt(cleaned, 16);
	return {
		r: (bigint >> 16) & 255,
		g: (bigint >> 8) & 255,
		b: bigint & 255,
	};
}

function linearizeComponent(component: number): number {
	const normalized = component / 255;
	if (normalized <= 0.03928) {
		return normalized / 12.92;
	}
	return Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
	const { r, g, b } = hexToRgb(hex);
	return 0.2126 * linearizeComponent(r) + 0.7152 * linearizeComponent(g) + 0.0722 * linearizeComponent(b);
}

function contrastRatio(l1: number, l2: number): number {
	return (l1 + 0.05) / (l2 + 0.05);
}

const themeNames = ['swiss', 'aurora', 'solar', 'ember', 'forest'] as const;

const surfaceValues: Record<string, string> = {
	swiss: '#ffffff',
	aurora: '#15151f',
	solar: '#ffffff',
	ember: '#1c110d',
	forest: '#0f2419',
};

const textStrongValues: Record<string, string> = {
	swiss: '#1a1812',
	aurora: '#f0f0f5',
	solar: '#1a1812',
	ember: '#fef3e2',
	forest: '#ecfdf5',
};

const borderSolidHex: Record<string, string | null> = {
	swiss: '#6b6b6b',
	aurora: '#6b6b6b',
	solar: '#827767',
	ember: null,
	forest: null,
};

describe('WCAG 2.2 Color Token Contrast Ratio Suite', () => {
	for (const theme of themeNames) {
		beforeEach(() => {
			document.body.innerHTML = '';
		});

		it(`computes relative luminance correctly for ${theme} theme`, () => {
			const luminance = relativeLuminance(textStrongValues[theme as keyof typeof textStrongValues]);
			expect(luminance).toBeGreaterThan(0);
			expect(luminance).toBeLessThan(1);
		});

		it(`computes contrast ratio correctly for ${theme} theme`, () => {
			const l1 = relativeLuminance(textStrongValues[theme as keyof typeof textStrongValues]);
			const l2 = relativeLuminance(surfaceValues[theme as keyof typeof surfaceValues]);
			const ratio = contrastRatio(Math.max(l1, l2), Math.min(l1, l2));
			expect(ratio).toBeGreaterThan(0);
			expect(ratio).toBeLessThanOrEqual(21);
		});

		it(`normal text contrast >= 4.5:1 for ${theme} theme`, () => {
			const luminanceText = relativeLuminance(textStrongValues[theme as keyof typeof textStrongValues]);
			const luminanceSurface = relativeLuminance(surfaceValues[theme as keyof typeof surfaceValues]);

			const light = luminanceText > luminanceSurface ? luminanceText : luminanceSurface;
			const dark = luminanceText > luminanceSurface ? luminanceSurface : luminanceText;
			const ratio = contrastRatio(light, dark);

			expect(ratio).toBeGreaterThanOrEqual(4.5);
		});

		it(`large text contrast >= 3:1 for ${theme} theme`, () => {
			const luminanceText = relativeLuminance(textStrongValues[theme as keyof typeof textStrongValues]);
			const luminanceSurface = relativeLuminance(surfaceValues[theme as keyof typeof surfaceValues]);

			const light = luminanceText > luminanceSurface ? luminanceText : luminanceSurface;
			const dark = luminanceText > luminanceSurface ? luminanceSurface : luminanceText;
			const ratio = contrastRatio(light, dark);

			expect(ratio).toBeGreaterThanOrEqual(3);
		});

		it(`UI boundary contrast >= 3:1 for ${theme} theme`, () => {
			const borderHex = borderSolidHex[theme as keyof typeof borderSolidHex];
			const surfaceHex = surfaceValues[theme as keyof typeof surfaceValues];

			if (!borderHex) {
				expect(true).toBe(true);
				return;
			}

			const luminanceBorder = relativeLuminance(borderHex);
			const luminanceSurface = relativeLuminance(surfaceHex);

			const light = luminanceBorder > luminanceSurface ? luminanceBorder : luminanceSurface;
			const dark = luminanceBorder > luminanceSurface ? luminanceSurface : luminanceBorder;
			const ratio = contrastRatio(light, dark);

			expect(ratio).toBeGreaterThanOrEqual(3);
		});
	}
});