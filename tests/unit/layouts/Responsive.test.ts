import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Frontend responsiveness (#15)', () => {
	const read = (relative: string): string =>
		fs.readFileSync(path.resolve(process.cwd(), relative), 'utf-8');

	const headerNew = read('src/components/sections/HeaderNew.astro');
	const headerMobileDrawer = read('src/components/sections/header/HeaderMobileDrawer.astro');
	const headerScss = read('src/styles/sections/_header-new.scss');
	const footerScss = read('src/styles/sections/_footer-new.scss');

	describe('desktop + mobile foundations', () => {
		it('Layout ships a device-width viewport meta (mobile browsers scale correctly)', () => {
			const layout = read('src/layouts/Layout.astro');
			expect(layout).toMatch(/name=["']viewport["'][^>]*content=["']width=device-width/);
		});

		it('Header adapts at max-width 800px: desktop nav hides, hamburger + drawer appear', () => {
			expect(headerScss).toContain('@media (max-width: 800px)');
			expect(headerNew).toContain('data-header-toggle');
			expect(headerMobileDrawer).toContain('id="header-new-menu"');
			expect(headerMobileDrawer).toContain('header-new__list--mobile');
			expect(headerNew).toContain('aria-controls="header-new-menu"');
			expect(headerNew).toContain('aria-expanded');
		});

		it('Header drawer closes after a mobile nav choice and on Escape', () => {
			expect(headerNew).toContain("drawer.querySelectorAll('a[href]')");
			expect(headerNew).toContain("event.key === 'Escape'");
			expect(headerNew).toContain('setOpen(false)');
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
			expect(footerScss).toContain('@media (max-width: 820px)');
			expect(footerScss).toMatch(/\.footer-new__inner\s*\{\s*grid-template-columns:\s*1fr/);
		});
	});
});
