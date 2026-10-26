import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (relative: string): string =>
	fs.readFileSync(path.resolve(process.cwd(), relative), 'utf-8');

describe('Frontend responsiveness (#15)', () => {
	describe('desktop + mobile foundations', () => {
		it('Layout ships a device-width viewport meta (mobile browsers scale correctly)', () => {
			const layout = read('src/layouts/Layout.astro');
			expect(layout).toMatch(/name=["']viewport["'][^>]*content=["']width=device-width/);
		});

		it('Header adapts at max-width 800px: desktop nav hides, hamburger + drawer appear', () => {
			const header = read('src/components/sections/HeaderNew.astro');
			expect(header).toContain('@media (max-width: 800px)');
			expect(header).toContain('data-header-toggle');
			expect(header).toContain('id="header-new-menu"');
			expect(header).toContain('header-new__list--mobile');
			expect(header).toContain("aria-controls=\"header-new-menu\"");
			expect(header).toContain('aria-expanded');
		});

		it('Header drawer closes after a mobile nav choice and on Escape', () => {
			const header = read('src/components/sections/HeaderNew.astro');
			expect(header).toContain("drawer.querySelectorAll('a[href]')");
			expect(header).toContain("event.key === 'Escape'");
			expect(header).toContain('setOpen(false)');
		});
	});

	describe('section grids reflow on narrow viewports', () => {
		it('Pricing uses auto-fit minmax so tiers stack on small screens', () => {
			const pricing = read('src/components/sections/Pricing.astro');
			expect(pricing).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/);
		});

		it('Feature trio uses auto-fit minmax for desktop/mobile columns', () => {
			const features = read('src/components/sections/FeatureTrio.astro');
			expect(features).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/);
		});

		it('Footer collapses to a single column under 820px', () => {
			const footer = read('src/components/sections/FooterNew.astro');
			expect(footer).toContain('@media (max-width: 820px)');
			expect(footer).toMatch(/\.footer-new__inner\s*\{\s*grid-template-columns:\s*1fr/);
		});
	});
});
